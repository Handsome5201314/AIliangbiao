# OpenCloudOS 9 Docker Deployment Guide

This project is designed to run on a single OpenCloudOS 9 server with three Docker containers:

- `app`: Next.js application container
- `db`: PostgreSQL container
- `hermes`: Hermes Agent API Server container

Recommended public entrypoint:

- Nginx on the host handles `80/443`
- Nginx proxies traffic to `127.0.0.1:3000`
- PostgreSQL stays inside the Docker network and is not exposed to the public internet

## 1. Migration Package Workflow

Use a two-stage migration workflow before reinstalling the server:

1. Run a rehearsal export while production is still online
2. Validate that the dump, checksum, and `pg_restore --list` output were created
3. Enter a maintenance window before the real cutover
4. Run one final export and treat that last bundle as the only restore source

Direct export entrypoint:

```bash
SOURCE_DATABASE_URL='postgresql://user:password@old-host:5432/dbname' \
bash scripts/export-production-db.sh
```

Default bundle output:

- `backups/prod/<UTC timestamp>/production.dump`
- `backups/prod/<UTC timestamp>/production.dump.sha256`
- `backups/prod/<UTC timestamp>/production.dump.contents.txt`
- `backups/prod/<UTC timestamp>/restore-verification.sql`
- `backups/prod/<UTC timestamp>/env-snapshot-instructions.md`
- `backups/prod/<UTC timestamp>/manifest.json`

Important cutover rules:

- Do not reopen production traffic after the final dump
- Keep the current production `.env.production` offline and out of git
- Save the final bundle outside the server that is about to be reinstalled

## 2. Deployment Layout

Recommended directories on the server:

- App repo: `/opt/ai-scale-system/current`
- Runtime env file: `/opt/ai-scale-system/shared/.env.production`
- Database backups: `/var/backups/ai-scale-system/postgres`
- Hermes runtime data: Docker volume `ai-scale-hermes-data`
- Nginx site config: `/etc/nginx/conf.d/ai-scale-system.conf`

Recommended firewall / security group:

- Open: `22`, `80`, `443`
- Do not open: `5432`

## 3. Required Software On OpenCloudOS 9

Install base packages:

```bash
sudo dnf install -y dnf-plugins-core ca-certificates curl gnupg2 nginx firewalld
```

Add the Docker CE repository and install Docker Engine plus the Compose plugin:

```bash
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Install Certbot. If `python3-certbot-nginx` is not available from your enabled repositories, enable EPEL first and retry:

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
```

Enable the required services:

```bash
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
sudo systemctl enable --now firewalld
```

Apply the host firewall rules:

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Verify the runtime:

```bash
docker --version
docker compose version
sudo systemctl status docker --no-pager
```

OpenCloudOS 9 container guidance requires a Docker version newer than `20.10.9`.

## 4. Production Env File

Do not use the workspace `.env` file in production.

Create a dedicated server-side env file:

```bash
sudo mkdir -p /opt/ai-scale-system/shared
sudo cp /opt/ai-scale-system/current/.env.production.example /opt/ai-scale-system/shared/.env.production
sudo chmod 600 /opt/ai-scale-system/shared/.env.production
```

Minimum values to review before first launch:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `SESSION_SECRET`
- `APP_SESSION_SECRET`
- `ADMIN_SESSION_SECRET`
- `ADMIN_PASSWORD`
- `HERMES_API_SERVER_BASE_URL`
- `HERMES_API_SERVER_KEY`
- `HERMES_API_SERVER_MODEL`

Important defaults:

- `DATABASE_URL` and `DIRECT_URL` should point to `db:5432`, not `localhost`
- `HERMES_API_SERVER_BASE_URL` should point to the internal Compose hostname `http://hermes:8642/v1`
- `LOG_LEVEL` should stay at `info` or `warn` in production
- Reuse the existing production `.env.production` during the OpenCloudOS reinstall migration

Example database URLs inside Docker:

```env
DATABASE_URL=postgresql://ai_scale_app:<password>@db:5432/ai_scale_db
DIRECT_URL=postgresql://ai_scale_app:<password>@db:5432/ai_scale_db
```

## 5. Build And Start

From the repo root on the server:

```bash
cd /opt/ai-scale-system/current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production build

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d
```

Check status:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps
```

Health checks:

- App health endpoint: `GET /api/health`
- App container health: HTTP check against `http://127.0.0.1:3000/api/health`
- DB container health: `pg_isready`
- Hermes service: internal API server on `http://hermes:8642/v1`

## 6. Database Restore During Server Rebuild

Start the target PostgreSQL container first:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d db
```

Restore the final migration dump:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-restore.sh /path/to/backups/prod/<timestamp>/production.dump
```

Before restoring, review these files from the same backup bundle:

- `production.dump.sha256`
- `production.dump.contents.txt`
- `restore-verification.sql`
- `env-snapshot-instructions.md`
- `manifest.json`

Sanity check the dump file before restore:

```bash
docker run --rm -i postgres:16-bookworm pg_restore --list < /path/to/backups/prod/<timestamp>/production.dump
```

## 7. Prisma Schema Sync

After restoring data, run Prisma sync without `--accept-data-loss`:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-prisma-sync.sh
```

If Prisma reports a destructive change, stop here and review manually before serving production traffic.

## 8. Data Verification

Use the generated `restore-verification.sql` file from the backup bundle and compare row counts between:

- the old production database
- the new PostgreSQL container database

The verification query checks these physical tables:

- `User`
- `ChildProfile`
- `DoctorProfile`
- `AssessmentHistory`
- `Admin`
- `ApiKey`
- `SystemConfig`

Note:

- `MemberProfile` is mapped to the physical table `ChildProfile`

## 9. Nginx Reverse Proxy

Use the example config in:

- `deploy/nginx/ai-scale-system.conf.example`

Copy it into place and replace `example.com` with the real domain:

```bash
sudo cp deploy/nginx/ai-scale-system.conf.example /etc/nginx/conf.d/ai-scale-system.conf
sudo nginx -t
sudo systemctl reload nginx
```

SSE-specific handling for `/api/mcp` is already included:

- `proxy_http_version 1.1`
- `proxy_buffering off`
- `proxy_read_timeout 3600s`
- `X-Accel-Buffering no`

## 10. HTTPS Certificate

After DNS points to the rebuilt server:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot --nginx -d example.com
```

Verify auto-renew:

```bash
sudo systemctl status certbot.timer
```

## 11. Backups

Manual backup of the live containerized database:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-backup.sh
```

Default backup location:

- `/var/backups/ai-scale-system/postgres`

Default retention:

- `14` days

Cron example for a nightly backup at 03:30:

```cron
30 3 * * * cd /opt/ai-scale-system/current && APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres bash scripts/docker-db-backup.sh >> /var/log/ai-scale-db-backup.log 2>&1
```

Install the cron entry automatically on the server:

```bash
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres \
BACKUP_RETENTION_DAYS=14 \
bash scripts/install-db-backup-cron.sh
```

Restore test:

- Periodically restore a recent dump into a non-production database before trusting the backup policy

## 12. Smoke Tests

After the containers and Nginx are online, verify:

- `/`
- `/agent`
- Admin login
- Patient login
- Doctor login
- `/api/agent/session`
- `/api/skill/v1/scales`
- `/api/auth/me`
- `/api/doctor/workspace`
- `/api/mcp`
- Hermes API server is reachable from the app container on `http://hermes:8642/v1`

Also confirm:

- `docker compose ps` shows the full app stack running
- `docker logs ai-scale-app` does not print Prisma `query` logs in production
- the server cannot be reached on public `5432`

## 13. Common Operations

Restart services:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production restart
```

Follow logs:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production logs -f app
```

Stop services:

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production down
```

Redeploy a new application release from your workstation:

```bash
DEPLOY_PASSWORD='your-ssh-password' \
python scripts/docker-redeploy.py --host tongyimohe.cloud --user root
```

Useful flags:

- `--skip-backup`: skip the pre-deploy database dump
- `--skip-prisma-push`: skip `prisma db push`
- `--keep-releases 3`: keep the current release plus the two most recent older releases after deploy

Run a one-time server cleanup manually:

```bash
sudo APP_BASE=/opt/ai-scale-system KEEP_RELEASES=3 \
bash scripts/docker-server-cleanup.sh
```

## 14. Rollback

Recommended rollback order:

1. Keep the PostgreSQL volume untouched unless the rollback explicitly requires data restore
2. Re-deploy the previous app image or previous git revision
3. Restart the stack
4. If data must be rolled back, restore from a known-good dump and re-run Prisma sync only after review

For containerized rollback, the safest first move is to restore the previous application build while preserving the current database volume.

## 15. Reference Material

- OpenCloudOS Docker guide: https://docs.opencloudos.org/OCS/Virtualization_and_Containers_Guide/Docker_guide/
- OpenCloudOS 9 installation docs: https://docs.opencloudos.org/en/OC9/install/
- Docker Engine on RPM-based distros: https://docs.docker.com/engine/install/centos/
