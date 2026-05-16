#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV_FILE="${APP_ENV_FILE:-/opt/ai-scale-system/shared/.env.production}"
DB_BACKUP_DIR="${DB_BACKUP_DIR:-/var/backups/ai-scale-system/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-30 3 * * *}"
BACKUP_LOG_FILE="${BACKUP_LOG_FILE:-/var/log/ai-scale-db-backup.log}"

mkdir -p "$DB_BACKUP_DIR"
touch "$BACKUP_LOG_FILE"

JOB="${BACKUP_SCHEDULE} cd ${ROOT_DIR} && APP_ENV_FILE=${APP_ENV_FILE} DB_BACKUP_DIR=${DB_BACKUP_DIR} BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS} bash scripts/docker-db-backup.sh >> ${BACKUP_LOG_FILE} 2>&1"

existing="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$existing" | grep -v 'scripts/docker-db-backup.sh' || true)"

{
  if [[ -n "$filtered" ]]; then
    printf '%s\n' "$filtered"
  fi
  printf '%s\n' "$JOB"
} | crontab -

printf 'Installed cron job:\n%s\n' "$JOB"
