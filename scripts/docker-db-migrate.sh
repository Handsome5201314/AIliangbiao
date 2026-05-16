#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${APP_ENV_FILE:-$ROOT_DIR/.env.production.example}"
BACKUP_DIR="${DB_BACKUP_DIR:-/var/backups/ai-scale-system/postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-${1:-}}"
source "$ROOT_DIR/scripts/docker-env.sh"

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  echo "Usage: SOURCE_DATABASE_URL=postgresql://... bash scripts/docker-db-migrate.sh" >&2
  echo "   or: bash scripts/docker-db-migrate.sh 'postgresql://...'" >&2
  exit 1
fi

require_env_file "$ENV_FILE"
POSTGRES_DB="$(read_env_value "$ENV_FILE" POSTGRES_DB)"

mkdir -p "$BACKUP_DIR"

DUMP_PATH="$BACKUP_DIR/${POSTGRES_DB}_migration_${TIMESTAMP}.dump"

docker run --rm postgres:16-bookworm \
  pg_dump --format=custom --no-owner --no-privileges --dbname="$SOURCE_DATABASE_URL" > "$DUMP_PATH"

cat "$DUMP_PATH" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --clean --if-exists --no-owner --no-privileges -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Migration dump created at $DUMP_PATH and restored into the db container"
