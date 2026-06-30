#!/usr/bin/env bash

set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://gitee.com/lishuaishuai1314520/AIliangbiao.git}"
BRANCH="${BRANCH:-main}"
APP_BASE="${APP_BASE:-/opt/ai-scale-system}"
ENV_PATH_PROVIDED="${ENV_PATH+x}"
ENV_PATH="${ENV_PATH:-$APP_BASE/shared/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-scale-system/postgres}"
DOMAIN="${DOMAIN:-tongyimohe.cloud}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
COMMIT="${COMMIT:-}"

DIFF_ONLY=false
PREPARE_ONLY=false
SKIP_CLEANUP=false

TARGET_COMMIT=""
TARGET_LABEL=""
APP_RECREATED=false
PREVIOUS_CURRENT=""

usage() {
  cat <<'EOF'
Usage: scripts/tencent-gitee-upgrade.sh [options]

Server-side Tencent Cloud upgrade script. It pulls a confirmed release from Gitee,
backs up the production database, runs prisma migrate deploy, recreates app only,
checks health, then switches /opt/ai-scale-system/current.

Options:
  --repo-url <url>      Git repository URL. Default: Gitee AIliangbiao repo.
  --branch <name>      Branch to deploy. Default: main.
  --commit <sha>       Deploy a specific commit already reachable from the repo.
  --app-base <path>    App base directory. Default: /opt/ai-scale-system.
  --env-path <path>    Production env path. Default: <app-base>/shared/.env.production.
  --backup-dir <path>  PostgreSQL dump directory. Default: /var/backups/ai-scale-system/postgres.
  --domain <domain>    Public health-check domain. Default: tongyimohe.cloud.
  --keep-releases <n>  Number of release dirs to keep. Default: 3.
  --diff-only          Show target/current diff only; do not touch DB, Docker, app, or current.
  --prepare-only       Create release, backup DB, build app, ensure db; stop before Prisma/app/current.
  --skip-cleanup       Do not remove old release dirs after a successful upgrade.
  -h, --help           Show this help.
EOF
}

log() {
  printf '[ai-scale-upgrade] %s\n' "$*"
}

die() {
  printf '[ai-scale-upgrade] ERROR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-url)
      REPO_URL="${2:?missing value for --repo-url}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:?missing value for --branch}"
      shift 2
      ;;
    --commit)
      COMMIT="${2:?missing value for --commit}"
      shift 2
      ;;
    --app-base)
      APP_BASE="${2:?missing value for --app-base}"
      if [[ -z "$ENV_PATH_PROVIDED" ]]; then
        ENV_PATH="$APP_BASE/shared/.env.production"
      fi
      shift 2
      ;;
    --env-path)
      ENV_PATH="${2:?missing value for --env-path}"
      ENV_PATH_PROVIDED=1
      shift 2
      ;;
    --backup-dir)
      BACKUP_DIR="${2:?missing value for --backup-dir}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:?missing value for --domain}"
      shift 2
      ;;
    --keep-releases)
      KEEP_RELEASES="${2:?missing value for --keep-releases}"
      shift 2
      ;;
    --diff-only)
      DIFF_ONLY=true
      shift
      ;;
    --prepare-only)
      PREPARE_ONLY=true
      shift
      ;;
    --skip-cleanup)
      SKIP_CLEANUP=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_tools() {
  require_command git
  require_command tar
  require_command docker
  require_command curl
  require_command date
  require_command readlink
}

require_env_file() {
  [[ -f "$ENV_PATH" ]] || die "Production env file not found: $ENV_PATH"
}

prepare_repo() {
  local repo_dir="$1"
  mkdir -p "$(dirname "$repo_dir")"

  if [[ -d "$repo_dir/.git" ]]; then
    git -C "$repo_dir" remote set-url origin "$REPO_URL"
  else
    git clone --no-checkout "$REPO_URL" "$repo_dir"
  fi

  git -C "$repo_dir" fetch --prune origin "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"

  if [[ -n "$COMMIT" ]]; then
    TARGET_COMMIT="$(git -C "$repo_dir" rev-parse "${COMMIT}^{commit}")"
    TARGET_LABEL="$COMMIT"
  else
    TARGET_COMMIT="$(git -C "$repo_dir" rev-parse "refs/remotes/origin/${BRANCH}^{commit}")"
    TARGET_LABEL="origin/${BRANCH}"
  fi
}

extract_tree() {
  local repo_dir="$1"
  local target_commit="$2"
  local output_dir="$3"

  mkdir -p "$output_dir"
  git -C "$repo_dir" archive "$target_commit" | tar -x -C "$output_dir"
}

print_current_diff() {
  local repo_dir="$1"
  local current_link="$APP_BASE/current"
  local current_dir=""
  local current_commit=""
  local temp_root=""
  local candidate_dir=""

  current_dir="$(readlink -f "$current_link" 2>/dev/null || true)"

  log "Repository: $REPO_URL"
  log "Target ref: $TARGET_LABEL"
  log "Target commit: $TARGET_COMMIT"
  log "Current release: ${current_dir:-missing}"

  if [[ -n "$current_dir" && -f "$current_dir/.release-commit" ]]; then
    current_commit="$(tr -d '[:space:]' < "$current_dir/.release-commit")"
    log "Current commit: $current_commit"
    log "Git diff against current commit:"
    git -C "$repo_dir" diff --name-status "$current_commit" "$TARGET_COMMIT" -- || true
    return
  fi

  if [[ -n "$current_dir" && -d "$current_dir" ]]; then
    temp_root="$(mktemp -d)"
    candidate_dir="$temp_root/candidate"
    extract_tree "$repo_dir" "$TARGET_COMMIT" "$candidate_dir"
    log "File diff against current release:"
    diff -qr \
      -x .env \
      -x .env.production \
      -x node_modules \
      -x .next \
      "$current_dir" "$candidate_dir" || true
    rm -rf "$temp_root"
    return
  fi

  log "No current release found; target commit would be installed as the first release."
}

compose() {
  local release_dir="$1"
  shift
  APP_ENV_FILE="$ENV_PATH" docker compose -f "$release_dir/docker-compose.prod.yml" --env-file "$ENV_PATH" "$@"
}

rollback_app_on_error() {
  local exit_code=$?

  if [[ "$APP_RECREATED" == "true" && -n "$PREVIOUS_CURRENT" && -d "$PREVIOUS_CURRENT" ]]; then
    log "Deployment failed after app recreation; starting previous app release again."
    APP_ENV_FILE="$ENV_PATH" \
      docker compose -f "$PREVIOUS_CURRENT/docker-compose.prod.yml" --env-file "$ENV_PATH" \
      up -d --no-deps app || true
  fi

  exit "$exit_code"
}

wait_for_local_health() {
  local attempts=30

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
      return 0
    fi
    sleep 2
  done

  return 1
}

cleanup_old_releases() {
  local releases_dir="$APP_BASE/releases"
  local current_dir=""
  local count=0

  current_dir="$(readlink -f "$APP_BASE/current" 2>/dev/null || true)"

  while IFS= read -r release_dir; do
    count=$((count + 1))
    if (( count <= KEEP_RELEASES )); then
      continue
    fi
    if [[ -n "$current_dir" && "$(readlink -f "$release_dir")" == "$current_dir" ]]; then
      continue
    fi
    log "Removing old release: $release_dir"
    rm -rf "$release_dir"
  done < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -r -n | cut -d' ' -f2-)
}

main() {
  local repo_dir=""
  local temp_root=""
  local release_id=""
  local release_dir=""

  require_tools

  if [[ "$DIFF_ONLY" == "true" ]]; then
    temp_root="$(mktemp -d)"
    repo_dir="$temp_root/repo"
    prepare_repo "$repo_dir"
    print_current_diff "$repo_dir"
    rm -rf "$temp_root"
    exit 0
  fi

  require_env_file

  mkdir -p "$APP_BASE/releases" "$APP_BASE/shared" "$BACKUP_DIR"
  repo_dir="$APP_BASE/repo-cache"
  prepare_repo "$repo_dir"
  print_current_diff "$repo_dir"

  release_id="$(date -u +%Y%m%d-%H%M%S)-${TARGET_COMMIT:0:8}"
  release_dir="$APP_BASE/releases/$release_id"
  [[ ! -e "$release_dir" ]] || die "Release already exists: $release_dir"

  log "Creating release: $release_dir"
  extract_tree "$repo_dir" "$TARGET_COMMIT" "$release_dir"
  printf '%s\n' "$TARGET_COMMIT" > "$release_dir/.release-commit"
  printf '%s\n' "$REPO_URL" > "$release_dir/.release-repo"
  printf '%s\n' "$BRANCH" > "$release_dir/.release-branch"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$release_dir/.release-created-at"
  ln -sfn "$ENV_PATH" "$release_dir/.env"
  ln -sfn "$ENV_PATH" "$release_dir/.env.production"

  log "Running pre-deploy database backup."
  (
    cd "$release_dir"
    APP_ENV_FILE="$ENV_PATH" DB_BACKUP_DIR="$BACKUP_DIR" bash scripts/docker-db-backup.sh
  )

  log "Building app image."
  compose "$release_dir" build app

  log "Ensuring database container is running."
  compose "$release_dir" up -d db

  if [[ "$PREPARE_ONLY" == "true" ]]; then
    log "Prepared release: $release_dir"
    log "No Prisma migration, app recreation, health switch, or current symlink change was performed."
    exit 0
  fi

  PREVIOUS_CURRENT="$(readlink -f "$APP_BASE/current" 2>/dev/null || true)"
  trap rollback_app_on_error ERR

  log "Running prisma migrate deploy."
  compose "$release_dir" run --rm --no-deps app npx prisma migrate deploy

  log "Recreating app container without starting compose-managed Hermes."
  compose "$release_dir" up -d --no-deps app
  APP_RECREATED=true

  log "Waiting for local health check."
  wait_for_local_health

  if [[ -n "$DOMAIN" ]]; then
    log "Checking public health endpoint: https://$DOMAIN/api/health"
    curl -k -fsS "https://$DOMAIN/api/health" >/dev/null
  fi

  log "Switching current release."
  ln -sfn "$release_dir" "$APP_BASE/current"
  APP_RECREATED=false
  trap - ERR

  if [[ "$SKIP_CLEANUP" == "true" ]]; then
    log "Skipping old release cleanup."
  else
    cleanup_old_releases
  fi

  log "Upgrade complete."
  log "Current release: $(readlink -f "$APP_BASE/current")"
  log "Commit: $TARGET_COMMIT"
}

main "$@"
