#!/usr/bin/env bash

set -euo pipefail

cd /tmp

log() {
  printf '[tencent-migrate] %s\n' "$1"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required env: %s\n' "$name" >&2
    exit 1
  fi
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

  if [[ -L "$CURRENT_LINK" || -d "$CURRENT_LINK" ]]; then
    tar --exclude=node_modules --exclude=.next -czf "$BACKUP_DIR/app/current-app.tgz" -C "$CURRENT_LINK" . || true
  fi
}

recreate_database() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
DROP ROLE IF EXISTS ${DB_USER};
CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
}

restore_database() {
  sudo -u postgres pg_restore --clean --if-exists --no-owner --no-privileges -d "$DB_NAME" "$DB_DUMP"
}

fix_database_permissions() {
  sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
DO \$\$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname, c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
  LOOP
    IF rec.relkind IN ('r', 'p') THEN
      EXECUTE format('ALTER TABLE %I.%I OWNER TO ${DB_USER}', rec.nspname, rec.relname);
    ELSIF rec.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO ${DB_USER}', rec.nspname, rec.relname);
    ELSIF rec.relkind = 'v' THEN
      EXECUTE format('ALTER VIEW %I.%I OWNER TO ${DB_USER}', rec.nspname, rec.relname);
    ELSIF rec.relkind = 'm' THEN
      EXECUTE format('ALTER MATERIALIZED VIEW %I.%I OWNER TO ${DB_USER}', rec.nspname, rec.relname);
    ELSIF rec.relkind = 'f' THEN
      EXECUTE format('ALTER FOREIGN TABLE %I.%I OWNER TO ${DB_USER}', rec.nspname, rec.relname);
    END IF;
  END LOOP;

  FOR rec IN
    SELECT n.nspname, t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e', 'd')
  LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO ${DB_USER}', rec.nspname, rec.typname);
  END LOOP;

  FOR rec IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    IF rec.prokind = 'p' THEN
      EXECUTE format('ALTER PROCEDURE %I.%I(%s) OWNER TO ${DB_USER}', rec.nspname, rec.proname, rec.args);
    ELSE
      EXECUTE format('ALTER FUNCTION %I.%I(%s) OWNER TO ${DB_USER}', rec.nspname, rec.proname, rec.args);
    END IF;
  END LOOP;
END
\$\$;
GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO ${DB_USER};
SQL
}

write_env_file() {
  mkdir -p "$SHARED_DIR" "$LOG_DIR" "$RELEASES_DIR"
  cat >"$ENV_PATH" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
NEXT_PUBLIC_APP_URL="${VALIDATION_URL}"
NEXT_PUBLIC_API_URL="${VALIDATION_URL}"
NEXT_PUBLIC_APP_NAME="${APP_NAME_PUBLIC}"
SESSION_SECRET="${SESSION_SECRET}"
ADMIN_USERNAME="${ADMIN_USERNAME}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY}"
TENCENT_SECRET_ID="${TENCENT_SECRET_ID}"
TENCENT_SECRET_KEY="${TENCENT_SECRET_KEY}"
TENCENT_SPEECH_SECRET_ID="${TENCENT_SPEECH_SECRET_ID}"
TENCENT_SPEECH_SECRET_KEY="${TENCENT_SPEECH_SECRET_KEY}"
ENABLE_VOICE_INTERACTION="${ENABLE_VOICE_INTERACTION}"
ENABLE_MCP_SERVER="${ENABLE_MCP_SERVER}"
CACHE_TTL="${CACHE_TTL}"
MAX_CACHE_SIZE="${MAX_CACHE_SIZE}"
LOG_LEVEL="${LOG_LEVEL}"
AGENTPIT_SHARED_BEARER="${AGENTPIT_SHARED_BEARER}"
AGENTPIT_CLIENT_ID="${AGENTPIT_CLIENT_ID}"
AGENTPIT_CLIENT_SECRET="${AGENTPIT_CLIENT_SECRET}"
AGENTPIT_OAUTH_BASE_URL="${AGENTPIT_OAUTH_BASE_URL}"
AGENTPIT_OAUTH_REDIRECT_URI="${AGENTPIT_OAUTH_REDIRECT_URI}"
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
  npx prisma db push --accept-data-loss
  npm run build
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
}

restart_app() {
  pm2 delete "$APP_NAME" || true
  pm2 delete medical-assessment || true

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

configure_nginx_ip_only() {
  cat >/etc/nginx/sites-available/ai-scale-system.conf <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

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

  rm -f /etc/nginx/sites-enabled/*
  ln -sfn /etc/nginx/sites-available/ai-scale-system.conf /etc/nginx/sites-enabled/ai-scale-system.conf
  nginx -t
  systemctl restart nginx
}

configure_nginx_domain_pre_ssl() {
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
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  rm -f /etc/nginx/sites-enabled/*
  ln -sfn /etc/nginx/sites-available/ai-scale-system.conf /etc/nginx/sites-enabled/ai-scale-system.conf
  nginx -t
  systemctl restart nginx
}

enable_ssl() {
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  systemctl enable --now certbot.timer
  certbot renew --dry-run
}

print_result() {
  python3 - <<PY
import json
print(json.dumps({
  "target_release": "${RELEASE_DIR}",
  "backup_dir": "${BACKUP_DIR}",
  "validation_url": "${VALIDATION_URL}",
  "ssl_enabled": ${SSL_ENABLED},
  "app_name": "${APP_NAME}",
  "env_path": "${ENV_PATH}"
}))
PY
}

require_env RELEASE_TARBALL
require_env DB_DUMP
require_env RELEASE_DIR
require_env RELEASES_DIR
require_env CURRENT_LINK
require_env SHARED_DIR
require_env ENV_PATH
require_env LOG_DIR
require_env APP_NAME
require_env APP_NAME_PUBLIC
require_env DB_NAME
require_env DB_USER
require_env DB_PASSWORD
require_env SESSION_SECRET
require_env ADMIN_USERNAME
require_env ADMIN_PASSWORD
require_env VALIDATION_URL
require_env BACKUP_DIR
require_env SSL_ENABLED

log "install runtime"
install_runtime
log "backup current state"
backup_state
log "recreate database"
recreate_database
log "restore database dump"
restore_database
log "fix database ownership and grants"
fix_database_permissions
log "write env file"
write_env_file
log "extract release"
extract_release
log "build release"
build_release
log "restart app"
restart_app

if [[ "$SSL_ENABLED" == "1" ]]; then
  require_env DOMAIN
  log "configure nginx for domain"
  configure_nginx_domain_pre_ssl
  log "enable ssl"
  enable_ssl
else
  log "configure nginx for ip validation"
  configure_nginx_ip_only
fi

print_result
