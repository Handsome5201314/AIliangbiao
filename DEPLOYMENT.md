# AI量表系统部署与运维手册

本文是 AI量表系统的部署 source of truth，覆盖本地演示、新服务器首次安装、已有生产库升级到新 Prisma 基线、日常 redeploy、备份恢复和回滚。目标是让云服务器只运行 Git 仓库中已确认的版本，生产环境变量和数据库数据始终留在服务器侧。

## 总原则

- 发布源：云端只部署 Git 仓库中已确认的版本，不从本地临时文件、构建产物或手工补丁发布；腾讯云默认从 `https://gitee.com/lishuaishuai1314520/AIliangbiao.git` 拉取。
- 运行拓扑：生产 Compose 保留 `app + db + hermes` 三容器拓扑；如果 Hermes 已同机 Docker 独立部署，腾讯云 Gitee 升级脚本只重建 `app` 和维护 `db`，不接管 Hermes 核心容器。
- 数据库镜像：PostgreSQL 使用 `pgvector/pgvector:0.8.3-pg16`，确保 `vector` 扩展可用。
- 生产 env：`/opt/ai-scale-system/shared/.env.production` 留在服务器，不进入 Git，不打包进 release。
- `/admin/apikeys` 与 `/admin/agent` 是项目自己的 AI 控制面；项目侧 provider key 存在数据库，不写入 release。
- `HERMES_API_SERVER_*` 只用于 app 连接内部 Hermes Runtime；Hermes 上游模型供应商配置留在 Hermes 自己的数据目录。
- 生产迁移：禁止 `prisma db push`；只允许备份、审查、`prisma migrate deploy` 和经确认的 `prisma migrate resolve`。
- 生产写库：任何写生产数据库的操作前，必须先完成备份和本地恢复演练，并把 SQL/迁移、备份路径、回滚方案提交人工确认。
- 回滚优先级：先回滚应用版本并保留数据库 volume；只有确实需要数据回退时，才恢复已验证的 dump。

## 目录约定

服务器推荐布局：

- 仓库当前版本：`/opt/ai-scale-system/current`
- release 目录：`/opt/ai-scale-system/releases/<UTC timestamp>`
- Gitee 拉取缓存：`/opt/ai-scale-system/repo-cache`
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

## AI 配置边界

这套部署有三层容易混淆的配置：

- 项目 AI 控制面：`/admin/apikeys` 管理项目自己的 provider/key/endpoint/model 池，`/admin/agent` 管理 Agent 的 provider/model 偏好。
- app -> Hermes Runtime：`/opt/ai-scale-system/shared/.env.production` 中的 `HERMES_API_SERVER_BASE_URL`、`HERMES_API_SERVER_KEY`、`HERMES_API_SERVER_MODEL` 只负责应用容器连接内部 Hermes API。
- Hermes 上游模型配置：保存在 Hermes 自己的数据目录（容器内 `/opt/data` 的 `.env` / `config.yaml`，宿主机对应 Hermes volume）。

其中 `HERMES_API_SERVER_KEY` 不是 DeepSeek/OpenAI 的上游供应商密钥；它只是 app 调 Hermes 时的内部鉴权口令。历史上示例 env 里出现过 `DEEPSEEK_API_KEY`，但它不是 Hermes 自动读取的上游切换入口。

如果 Hermes 是同机 Docker 独立部署：

- `HERMES_API_SERVER_BASE_URL` 推荐写成 `http://<hermes-container-name>:8642/v1`，并把 Hermes 容器接入 `ai-scale-internal` 网络。
- `HERMES_API_SERVER_KEY` 必须与 Hermes 容器里的 `API_SERVER_KEY` 一致。
- DeepSeek/OpenAI/OneAPI 等 Hermes 上游 key 写在 Hermes 自己的 env 或 `/opt/data` 对应挂载目录中的 `.env` / `config.yaml`，不写入 AI量表系统的 `/admin/apikeys`。
- 只读确认 Hermes 挂载路径时用 `docker inspect <hermes-container> --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'`；不要把包含真实 key 的 env 输出粘贴到聊天或公开日志。

第一阶段家长语音答题的正式数据源只在项目数据库：

- `AiConversationSession` / `AiConversationEvent` 记录 ASR、转写、用户原话、Hermes 辅助映射、确认、fallback、tool call、TTS 和最终答案提交轨迹。
- `/admin/ai-logs` 是超级管理员复盘入口；OpenWebUI / Hermes 控制台只能作为调试链接，新标签页打开，不作为审计或科研导出来源。
- 科研导出复用项目 `research-export` 服务，默认脱敏并优先导出已确认答案相关事件。
- ASR/TTS 属于项目侧 adapter。ASR 第一阶段默认兼容 SiliconFlow SenseVoiceSmall；TTS 默认 browser，可按后台配置切到项目侧 provider adapter。
- Hermes 是 Runtime，只做对话理解、模糊回答追问和结构化候选输出；最终答案合法性、入库、计分、报告、权限与审计必须由项目代码完成。

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

- `db`: `pgvector/pgvector:0.8.3-pg16`
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
sudo git clone https://gitee.com/lishuaishuai1314520/AIliangbiao.git releases/<release-id>
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
`HERMES_API_SERVER_KEY` 只用于 app -> Hermes 的内部鉴权，不是 DeepSeek/OpenAI 的服务商 key。若要配置项目自己的 AI 服务商，请在首次登录后通过 `/admin/apikeys` 管理；若要修改 Hermes 自己直连的上游 provider，请改 Hermes 数据目录中的 `.env` / `config.yaml`。

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

先准备新 release、执行备份、构建镜像并用新 compose 启动 `db`。这一步不会执行 Prisma、不会重建 app、不会切换 `current`：

```bash
DEPLOY_PASSWORD='use-env-only' \
python scripts/docker-redeploy.py --host tongyimohe.cloud --prepare-only
```

```bash
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production run --rm --no-deps app \
  npx prisma migrate resolve --applied 20260627_baseline

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production run --rm --no-deps app \
  npx prisma migrate deploy
```

## 腾讯云 Gitee 一键升级

腾讯云推荐直接在服务器上从 Gitee 拉取已确认版本，不再从本地临时文件打包上传。Gitee 仓库是公开仓库时，服务器不需要 deploy key：

```bash
cd /opt/ai-scale-system/current
bash scripts/tencent-gitee-upgrade.sh --diff-only
```

确认差异后执行升级。已有生产库建议先保留旧 release，稳定后再单独清理：

```bash
cd /opt/ai-scale-system/current
bash scripts/tencent-gitee-upgrade.sh --skip-cleanup
```

如果当前服务器上的旧 release 还没有这个脚本，可先用临时目录从 Gitee 拉取脚本，再由脚本创建正式 release：

```bash
rm -rf /tmp/AIliangbiao-upgrade
git clone --depth 1 https://gitee.com/lishuaishuai1314520/AIliangbiao.git /tmp/AIliangbiao-upgrade
bash /tmp/AIliangbiao-upgrade/scripts/tencent-gitee-upgrade.sh --diff-only
bash /tmp/AIliangbiao-upgrade/scripts/tencent-gitee-upgrade.sh --skip-cleanup
```

锁定某个 commit 发布：

```bash
bash scripts/tencent-gitee-upgrade.sh --commit <commit-sha> --skip-cleanup
```

只准备 release、备份、构建镜像和启动 db，不执行 Prisma、不重建 app、不切换 `current`：

```bash
bash scripts/tencent-gitee-upgrade.sh --prepare-only --skip-cleanup
```

脚本行为：

1. 从 `https://gitee.com/lishuaishuai1314520/AIliangbiao.git` fetch/clone `main`。
2. 解析目标 commit，并显示目标版本与当前 release 的差异。
3. 用 `git archive` 创建新的 release 目录，并记录 `.release-commit`。
4. 链接服务器侧 `/opt/ai-scale-system/shared/.env.production`，不把 env 写进 Git。
5. 先执行 `scripts/docker-db-backup.sh` 备份生产数据库。
6. 构建 `app` 镜像，确保 `db` 容器运行。
7. 执行 `npx prisma migrate deploy`，不会运行 `prisma db push`。
8. 用 `docker compose up -d --no-deps app` 重建 app，避免启动或重建 compose 里的 Hermes 服务。
9. `http://127.0.0.1:3000/api/health` 和公网 `/api/health` 通过后才切换 `/opt/ai-scale-system/current`。
10. 默认只清理旧 release 目录，保留最近 3 个；不 prune Docker 镜像和构建缓存。

常用参数：

- `--diff-only`
- `--prepare-only`
- `--commit <sha>`
- `--branch main`
- `--skip-cleanup`
- `--keep-releases 3`
- `--repo-url https://gitee.com/lishuaishuai1314520/AIliangbiao.git`

升级后验证：

```bash
cd /opt/ai-scale-system/current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps

curl -fsS http://127.0.0.1:3000/api/health
curl -k -fsS https://tongyimohe.cloud/api/health
curl -fsS http://127.0.0.1:3000/api/internal/hermes/health || true
```

## 本地打包上传应急更新

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

如果本次发布需要强制保留所有旧 release，或不允许清理任何 Docker 镜像/构建缓存，可加 `--skip-cleanup`。已有生产库基线化窗口建议使用该参数，等新版本稳定后再单独评估清理。

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
docker run --rm -i pgvector/pgvector:0.8.3-pg16 pg_restore --list < /path/to/backup.dump
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

平台知识检索使用 `Unsupported("vector")` 字段，普通 PostgreSQL 镜像没有内置 pgvector 扩展。固定 `pgvector/pgvector:0.8.3-pg16` 可以保持 Postgres 16 兼容，同时让 `CREATE EXTENSION vector` 可用。

### 为什么旧 migration 被归档？

旧链从 `20260616_platform_knowledge_pgvector` 开始，不包含基础表创建；空库执行会先遇到不存在的表。新的 `20260627_baseline` 是从当前 `schema.prisma` 生成的完整基线，旧 SQL 原样保存在 `prisma/migrations_archive/pre_20260627_baseline/` 供审计。

### 已有生产库为什么不能直接 migrate deploy？

已有库已经有表。直接应用 baseline 会尝试重新创建这些表。正确做法是在备份、diff 和本地恢复演练通过后，用 `migrate resolve --applied 20260627_baseline` 告诉 Prisma 这条基线已由现有库承担。

### 什么时候可以用 --skip-prisma-migrate？

只有在确认本次 release 没有 schema/migration 变化，或迁移已在同一窗口单独完成并验证时才可以用。默认不要跳过迁移。

### 什么时候可以用 --prepare-only？

已有生产库需要切换到 pgvector 镜像并执行 catch-up SQL 时使用。它只准备 release、备份、构建和启动 db，明确不会执行 Prisma、不会重建 app、不会切换 `current`。

### 什么时候可以用 --skip-cleanup？

需要保留旧 release、避免 Docker image/cache prune 影响无关服务时使用。生产基线化和高风险发布窗口默认建议加上它，清理动作留到单独维护窗口。
