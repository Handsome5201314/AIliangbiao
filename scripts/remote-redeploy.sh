#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[deploy] %s\n' "$1"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required env: %s\n' "$name" >&2
    exit 1
  fi
}

run_pg_sql() {
  local sql="$1"
  local sql_file="/tmp/ai-scale-sql-${RELEASE_ID}.sql"
  printf '%s\n' "$sql" >"$sql_file"
  chmod 644 "$sql_file"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -f "$sql_file"
  rm -f "$sql_file"
}

install_runtime() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl ca-certificates gnupg nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20.* ]]; then
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi

  systemctl enable --now postgresql
  systemctl enable --now nginx

  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
}

backup_state() {
  mkdir -p "$BACKUP_DIR/nginx" "$BACKUP_DIR/app" "$BACKUP_DIR/postgres" "$BACKUP_DIR/meta"
  cp -a /etc/nginx/sites-available "$BACKUP_DIR/nginx/" || true
  cp -a /etc/nginx/sites-enabled "$BACKUP_DIR/nginx/" || true
  pm2 jlist >"$BACKUP_DIR/meta/pm2-jlist.json" || true
  ss -ltnp >"$BACKUP_DIR/meta/ports.txt" || true
  sudo -u postgres pg_dumpall >"$BACKUP_DIR/postgres/pg_dumpall.sql" || true

  local current_pid current_cwd
  current_pid="$(ss -ltnp | awk '/:3000 / {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)"
  if [[ -n "$current_pid" && -d "/proc/$current_pid/cwd" ]]; then
    current_cwd="$(readlink -f "/proc/$current_pid/cwd")"
    tar --exclude=node_modules --exclude=.next -czf "$BACKUP_DIR/app/current-app.tgz" -C "$current_cwd" . || true
  fi

  if [[ -d /root/AIliangbiao ]]; then
    tar --exclude=node_modules --exclude=.next -czf "$BACKUP_DIR/app/root-AIliangbiao.tgz" -C /root/AIliangbiao . || true
  fi
}

free_https_port() {
  if grep -q '^Port 443$' /etc/ssh/sshd_config 2>/dev/null; then
    python3 - <<'PY'
from pathlib import Path
path = Path('/etc/ssh/sshd_config')
lines = [line for line in path.read_text().splitlines() if line.strip() != 'Port 443']
path.write_text('\n'.join(lines) + '\n')
PY
    sshd -t
    systemctl restart ssh || systemctl restart sshd
  fi
}

reset_database() {
  local role_prefix=''
  if sudo -u postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname = 'priv_esc' AND pg_has_role('postgres', 'priv_esc', 'MEMBER')" | grep -q 1; then
    role_prefix='SET ROLE priv_esc;'
  fi

  run_pg_sql "
${role_prefix}
DO \$\$
BEGIN
   IF EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
      PERFORM pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
   END IF;
END\$\$;
DROP DATABASE IF EXISTS ${DB_NAME};
DROP ROLE IF EXISTS ${DB_USER};
CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
RESET ROLE;
"
}

write_env_file() {
  mkdir -p "$SHARED_DIR" "$LOG_DIR" "$RELEASES_DIR"
  cat >"$ENV_PATH" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
NEXT_PUBLIC_API_URL="https://${DOMAIN}"
NEXT_PUBLIC_APP_NAME="AI Scale System"
SESSION_SECRET="${SESSION_SECRET}"
ADMIN_USERNAME="${ADMIN_USERNAME}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
DEEPSEEK_API_KEY=""
TENCENT_SECRET_ID=""
TENCENT_SECRET_KEY=""
TENCENT_SPEECH_SECRET_ID=""
TENCENT_SPEECH_SECRET_KEY=""
ENABLE_VOICE_INTERACTION="true"
ENABLE_MCP_SERVER="true"
CACHE_TTL="3600"
MAX_CACHE_SIZE="1000"
LOG_LEVEL="info"
EOF
  chmod 600 "$ENV_PATH"
}

extract_release() {
  mkdir -p "$RELEASE_DIR"
  tar -xzf "$RELEASE_TARBALL" -C "$RELEASE_DIR"
  ln -sfn "$ENV_PATH" "$RELEASE_DIR/.env"
  ln -sfn "$ENV_PATH" "$RELEASE_DIR/.env.production"
}

build_release() {
  cd "$RELEASE_DIR"
  npm ci
  npx prisma generate
  npx prisma db push
  npm run build
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
}

restart_app() {
  pm2 delete "$APP_NAME" || true
  pm2 delete ai-scale || true

  local current_pid
  current_pid="$(ss -ltnp | awk '/:3000 / {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)"
  if [[ -n "$current_pid" ]]; then
    kill -9 "$current_pid" || true
  fi

  cd "$CURRENT_LINK"
  pm2 start npm --name "$APP_NAME" -- start
  pm2 save
  pm2 startup systemd -u root --hp /root || true
}

configure_nginx() {
  mkdir -p /var/www/letsencrypt
  cat >/etc/nginx/sites-available/ai-scale-system.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

  rm -f /etc/nginx/sites-enabled/default
  rm -f /etc/nginx/sites-enabled/ai-scale
  ln -sfn /etc/nginx/sites-available/ai-scale-system.conf /etc/nginx/sites-enabled/ai-scale-system.conf
  nginx -t
  systemctl restart nginx
}

setup_ssl() {
  certbot certonly --webroot -w /var/www/letsencrypt --cert-name "$DOMAIN" -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
  systemctl enable --now certbot.timer
  certbot renew --dry-run
  systemctl restart nginx
}

init_admin() {
  curl -fsS http://127.0.0.1:3000/api/admin/login >/dev/null
  curl -fsS -X POST http://127.0.0.1:3000/api/admin/login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\"}" >/dev/null
}

print_result() {
  python3 - <<PY
import json
result = {
  "release_dir": "${RELEASE_DIR}",
  "backup_dir": "${BACKUP_DIR}",
  "env_path": "${ENV_PATH}",
  "app_name": "${APP_NAME}",
  "admin_username": "${ADMIN_USERNAME}",
  "admin_password": "${ADMIN_PASSWORD}",
  "database_url": "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}",
  "session_secret": "${SESSION_SECRET}",
}
print(json.dumps(result))
PY
}

require_env RELEASE_ID
require_env RELEASE_TARBALL
require_env DOMAIN
require_env APP_BASE
require_env RELEASES_DIR
require_env CURRENT_LINK
require_env SHARED_DIR
require_env ENV_PATH
require_env LOG_DIR
require_env APP_NAME
require_env DB_NAME
require_env DB_USER
require_env DB_PASSWORD
require_env SESSION_SECRET
require_env ADMIN_USERNAME
require_env ADMIN_PASSWORD
require_env BACKUP_DIR
require_env RELEASE_DIR

log "install runtime"
install_runtime
log "backup current state"
backup_state
log "free https port"
free_https_port
log "reset database"
reset_database
log "write env file"
write_env_file
log "extract release"
extract_release
log "build release"
build_release
log "restart app"
restart_app
log "configure nginx"
configure_nginx
log "setup ssl"
setup_ssl
log "init admin"
init_admin
print_result
