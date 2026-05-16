#!/usr/bin/env bash

set -euo pipefail

APP_BASE="${APP_BASE:-/opt/ai-scale-system}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
CURRENT_LINK="${CURRENT_LINK:-$APP_BASE/current}"
RELEASES_DIR="${RELEASES_DIR:-$APP_BASE/releases}"

if ! [[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] || [[ "$KEEP_RELEASES" -lt 1 ]]; then
  echo "KEEP_RELEASES must be a positive integer" >&2
  exit 1
fi

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "Releases directory not found: $RELEASES_DIR" >&2
  exit 1
fi

log() {
  printf '[docker-cleanup] %s\n' "$1"
}

print_usage_snapshot() {
  log "Disk usage"
  df -h / /opt /var 2>/dev/null || df -h /
  log "Release sizes"
  du -sh "$RELEASES_DIR"/* 2>/dev/null | sort -h || true
  log "Docker usage"
  docker system df || true
}

current_target="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"

declare -a release_dirs=()
while IFS= read -r release_dir; do
  [[ -n "$release_dir" ]] || continue
  release_dirs+=("$release_dir")
done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r)

declare -a keep_dirs=()
if [[ -n "$current_target" && -d "$current_target" ]]; then
  keep_dirs+=("$current_target")
fi

for release_dir in "${release_dirs[@]}"; do
  skip=false
  for kept in "${keep_dirs[@]}"; do
    if [[ "$release_dir" == "$kept" ]]; then
      skip=true
      break
    fi
  done
  if [[ "$skip" == false ]]; then
    keep_dirs+=("$release_dir")
  fi
  if [[ "${#keep_dirs[@]}" -ge "$KEEP_RELEASES" ]]; then
    break
  fi
done

declare -a remove_dirs=()
for release_dir in "${release_dirs[@]}"; do
  keep=false
  for kept in "${keep_dirs[@]}"; do
    if [[ "$release_dir" == "$kept" ]]; then
      keep=true
      break
    fi
  done
  if [[ "$keep" == false ]]; then
    remove_dirs+=("$release_dir")
  fi
done

print_usage_snapshot

log "Keeping releases:"
for kept in "${keep_dirs[@]}"; do
  printf '  %s\n' "$kept"
done

if [[ "${#remove_dirs[@]}" -gt 0 ]]; then
  log "Removing old releases"
  for release_dir in "${remove_dirs[@]}"; do
    printf '  removing %s\n' "$release_dir"
    rm -rf "$release_dir"
  done
else
  log "No old releases to remove"
fi

log "Pruning unused docker images"
docker image prune -a -f || true

log "Pruning unused docker build cache"
docker builder prune -a -f || true

print_usage_snapshot
