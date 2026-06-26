# AI量表系统部署与运维手册

本文是 AI量表系统的部署 source of truth，覆盖本地演示、新服务器首次安装、已有生产库升级到新 Prisma 基线、日常 redeploy、备份恢复和回滚。目标是让云服务器只运行 Git 仓库中已确认的版本，生产环境变量和数据库数据始终留在服务器侧。

## 总原则

- 发布源：云端只部署 Git 仓库中已确认的版本，不从本地临时文件、构建产物或手工补丁发布。
- 运行拓扑：生产保持 `app + db + hermes` 三容器拓扑。
- 数据库镜像：PostgreSQL 使用 `pgvector/pgvector:0.8.3-pg16-bookworm`，确保 `vector` 扩展可用。
- 生产 env：`/opt/ai-scale-system/shared/.env.production` 留在服务器，不进入 Git，不打包进 release。
- 生产迁移：禁止 `prisma db push`；只允许备份、审查、`prisma migrate deploy` 和经确认的 `prisma migrate resolve`。
- 生产写库：任何写生产数据库的操作前，必须先完成备份和本地恢复演练，并把 SQL/迁移、备份路径、回滚方案提交人工确认。
- 回滚优先级：先回滚应用版本并保留数据库 volume；只有确实需要数据回退时，才恢复已验证的 dump。

## 目录约定

服务器推荐布局：

- 仓库当前版本：`/opt/ai-scale-system/current`
- release 目录：`/opt/ai-scale-system/releases/<UTC timestamp>`
- 生产 env：`/opt/ai-scale-system/shared/.env.production`
- 数据库备份：`/var/backups/ai-scale-system/postgres`
- Compose 文件：`docker-compose.prod.yml`

本仓库只保存：

- `.env.local.example`
- `.env.production.example`
- Compose、Dockerfile、Prisma schema/migrations、部署脚本和文档

本仓库不保存：

- `.env`
- `.env.local`
- `.env.production`
- 私钥、token、真实数据库 URL
- `node_modules`
- `.next`
- 临时文件和构建缓存

## 本地演示

### 1. 安装依赖

```powershell
npm install
```

### 2. 准备本地 env

```powershell
Copy-Item .env.local.example .env.local
```

本地 `.env.local` 只用于本机开发，不进入 Git。

### 3. 启动依赖服务

```powershell
npm run dev:services
```

等价于：

```powershell
docker compose -f docker-compose.dev.yml --env-file .env.local up -d
```

本地 Compose 会启动：

- `db`: `pgvector/pgvector:0.8.3-pg16-bookworm`
- `hermes`: `nousresearch/hermes-agent:latest`

### 4. 初始化空库 schema

```powershell
npm run db:dev:migrate
```

这个命令运行 `prisma migrate deploy`，从 `prisma/migrations/20260627_baseline` 初始化当前完整 schema。

### 5. 填充演示数据并启动应用

```powershell
npm run db:dev:seed
npm run dev
```

常用入口：

- `http://localhost:3000`
- `http://localhost:3000/agent`
- `http://localhost:3000/admin/login`

## 新服务器首次安装

### 1. 安装基础运行时

以 OpenCloudOS 9 / RHEL 系为例：

```bash
sudo dnf install -y dnf-plugins-core ca-certificates curl gnupg2 nginx firewalld
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Nginx、域名和 HTTPS 属于服务器入口层，除非有明确变更任务，不应由应用 redeploy 脚本修改。

### 2. 获取 Git 确认版本

```bash
sudo mkdir -p /opt/ai-scale-system/releases
cd /opt/ai-scale-system
sudo git clone <repo-url> releases/<release-id>
sudo ln -sfn /opt/ai-scale-system/releases/<release-id> /opt/ai-scale-system/current
```

`<release-id>` 应对应已确认的 commit、tag 或 release 包。

### 3. 准备生产 env

```bash
sudo mkdir -p /opt/ai-scale-system/shared
sudo cp /opt/ai-scale-system/current/.env.production.example /opt/ai-scale-system/shared/.env.production
sudo chmod 600 /opt/ai-scale-system/shared/.env.production
```

必须人工填写并离线保存：

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `APP_SESSION_SECRET`
- `ADMIN_SESSION_SECRET`
- `BUSINESS_SECRET_ENCRYPTION_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `HERMES_API_SERVER_KEY`
- 第三方服务所需的可选配置

容器内 `DATABASE_URL` / `DIRECT_URL` 必须指向 `db:5432`，不能指向 `localhost`。

### 4. 首次启动与迁移

```bash
cd /opt/ai-scale-system/current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production build

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d db hermes

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production run --rm --no-deps app npx prisma migrate deploy

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d app
```

### 5. 首次 smoke check

```bash
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps
curl http://127.0.0.1:3000/api/health
curl https://tongyimohe.cloud/api/health
```

公网检查失败时不要切换流量或宣布上线。

## 已有生产库升级到新基线

当前正式迁移基线为：

- `20260627_baseline`

这个 baseline 用于两类场景：

- 空库：直接 `prisma migrate deploy` 创建完整当前 schema。
- 已有生产库：确认 schema 与当前模型一致后，用 `prisma migrate resolve --applied 20260627_baseline` 写入迁移记录，再运行 `prisma migrate deploy`。

### 禁止事项

- 不允许对生产库运行 `prisma db push`。
- 不允许在未备份、未演练、未确认的情况下写 `_prisma_migrations`。
- 如果 schema diff 显示会删表、删列、改类型、丢数据或无法解释的差异，必须停止。

### 1. 云端只读盘点

```bash
python scripts/docker-redeploy.py --diff-only
readlink -f /opt/ai-scale-system/current
cd /opt/ai-scale-system/current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps
curl http://127.0.0.1:3000/api/health
curl https://tongyimohe.cloud/api/health
```

如需检查数据库扩展和迁移状态，先只读执行：

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production exec -T db \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select extname, extversion from pg_extension where extname = '\''vector'\'';"'

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production exec -T db \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select migration_name, finished_at from _prisma_migrations order by started_at;"'
```

### 2. 生产备份

```bash
cd /opt/ai-scale-system/current
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres \
bash scripts/docker-db-backup.sh
```

记录输出中的 dump 路径。不要把 dump 提交到 Git。

### 3. 本地恢复演练

将生产 dump 拉到本地安全目录后，在隔离数据库中恢复并验证：

```powershell
docker compose -f docker-compose.dev.yml --env-file .env.local up -d db
```

恢复 dump 到本地演练库后，检查：

```sql
select extname, extversion from pg_extension where extname = 'vector';

select
  (select count(*) from "User") as users,
  (select count(*) from "ChildProfile") as child_profiles,
  (select count(*) from "DoctorProfile") as doctor_profiles,
  (select count(*) from "AssessmentHistory") as assessments,
  (select count(*) from "SystemConfig") as system_configs;
```

如果本地 diff 确认已有库与 `prisma/schema.prisma` 对齐，则在演练库执行：

```bash
npx prisma migrate resolve --applied 20260627_baseline
npx prisma migrate deploy
```

这一步在本地演练库可以执行；在生产库执行前必须先汇报并等待确认。

### 4. 生产确认后执行

生产执行前报告至少包含：

- 本地恢复演练结果。
- 生产备份 dump 路径。
- 将执行的迁移命令或 SQL。
- `_prisma_migrations` 预期变化。
- 回滚方案。

确认后，已有生产库的最小写操作通常是：

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production run --rm --no-deps app \
  npx prisma migrate resolve --applied 20260627_baseline

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production run --rm --no-deps app \
  npx prisma migrate deploy
```

## 日常一键更新

从本地工作站触发云端只读 diff：

```bash
DEPLOY_PASSWORD='use-env-only' \
python scripts/docker-redeploy.py --host tongyimohe.cloud --diff-only
```

如果服务器使用 SSH key 登录，不要把私钥放进 Git；用本机路径注入：

```bash
DEPLOY_KEY_PATH=/path/to/deploy_key \
python scripts/docker-redeploy.py --host tongyimohe.cloud --diff-only
```

确认 diff 后执行 redeploy：

```bash
DEPLOY_PASSWORD='use-env-only' \
python scripts/docker-redeploy.py --host tongyimohe.cloud
```

脚本行为：

1. 读取本地 Git 跟踪文件并生成 release manifest。
2. 读取远端 `current` manifest 并显示 diff。
3. 打包上传 Git 跟踪文件，排除 env、secret、`node_modules`、构建缓存和临时文件。
4. 先做数据库备份。
5. 构建 app 镜像。
6. 确保 db 容器运行。
7. 运行 `prisma migrate deploy`。
8. 重建 app 容器。
9. 本地和公网健康检查都为 200 后才切换 `/opt/ai-scale-system/current`。
10. 清理旧 release。

常用参数：

- `--diff-only`
- `--skip-backup`：仅在已另有同窗口备份并明确确认时使用。
- `--skip-prisma-migrate`：仅在无 schema 变化或迁移已单独完成时使用。
- `--keep-releases 3`

## 备份与恢复

### 手工备份

```bash
cd /opt/ai-scale-system/current
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres \
bash scripts/docker-db-backup.sh
```

### 备份结构检查

```bash
docker run --rm -i pgvector/pgvector:0.8.3-pg16-bookworm pg_restore --list < /path/to/backup.dump
```

### 恢复

恢复会写数据库，只能在确认窗口执行：

```bash
cd /opt/ai-scale-system/current
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-restore.sh /path/to/backup.dump
```

恢复后必须核对核心表、`vector` 扩展和健康检查。

## 回滚

应用回滚：

```bash
sudo ln -sfn /opt/ai-scale-system/releases/<previous-release-id> /opt/ai-scale-system/current
cd /opt/ai-scale-system/current
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d app
```

数据回滚只在确认需要时执行：

```bash
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-restore.sh /path/to/verified-backup.dump
```

回滚后检查：

```bash
curl http://127.0.0.1:3000/api/health
curl https://tongyimohe.cloud/api/health
```

## 常见问题

### 为什么使用 pgvector 镜像？

平台知识检索使用 `Unsupported("vector")` 字段，普通 PostgreSQL 镜像没有内置 pgvector 扩展。固定 `pgvector/pgvector:0.8.3-pg16-bookworm` 可以保持 Postgres 16 兼容，同时让 `CREATE EXTENSION vector` 可用。

### 为什么旧 migration 被归档？

旧链从 `20260616_platform_knowledge_pgvector` 开始，不包含基础表创建；空库执行会先遇到不存在的表。新的 `20260627_baseline` 是从当前 `schema.prisma` 生成的完整基线，旧 SQL 原样保存在 `prisma/migrations_archive/pre_20260627_baseline/` 供审计。

### 已有生产库为什么不能直接 migrate deploy？

已有库已经有表。直接应用 baseline 会尝试重新创建这些表。正确做法是在备份、diff 和本地恢复演练通过后，用 `migrate resolve --applied 20260627_baseline` 告诉 Prisma 这条基线已由现有库承担。

### 什么时候可以用 --skip-prisma-migrate？

只有在确认本次 release 没有 schema/migration 变化，或迁移已在同一窗口单独完成并验证时才可以用。默认不要跳过迁移。
