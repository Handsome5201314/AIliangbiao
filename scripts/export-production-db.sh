#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-${1:-}}"

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  echo "Usage: SOURCE_DATABASE_URL=postgresql://... bash scripts/export-production-db.sh" >&2
  echo "   or: bash scripts/export-production-db.sh 'postgresql://...'" >&2
  exit 1
fi

SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" node "$ROOT_DIR/scripts/export-production-db.mjs"
