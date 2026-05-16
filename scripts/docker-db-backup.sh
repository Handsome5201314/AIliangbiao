#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${APP_ENV_FILE:-$ROOT_DIR/.env.production.example}"
BACKUP_DIR="${DB_BACKUP_DIR:-/var/backups/ai-scale-system/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
source "$ROOT_DIR/scripts/docker-env.sh"

require_env_file "$ENV_FILE"
POSTGRES_DB="$(read_env_value "$ENV_FILE" POSTGRES_DB)"

mkdir -p "$BACKUP_DIR"

BACKUP_PATH="$BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.dump"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_PATH"

find "$BACKUP_DIR" -type f -name '*.dump' -mtime +"$RETENTION_DAYS" -delete

echo "Backup written to $BACKUP_PATH"
