#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${APP_ENV_FILE:-$ROOT_DIR/.env.production.example}"

source "$ROOT_DIR/scripts/docker-env.sh"
require_env_file "$ENV_FILE"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app \
  npx prisma migrate deploy
