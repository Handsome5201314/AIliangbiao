# AI量表系统部署与运维手册

本文是 AI量表系统的部署 source of truth。目标是让云服务器只运行 Git/Gitee 仓库中已确认的版本，生产环境变量和数据库数据始终留在服务器侧。

## 总原则

- 发布源：腾讯云默认从 `https://gitee.com/lishuaishuai1314520/AIliangbiao.git` 拉取。
- 运行拓扑：生产 Compose 只接管 `app + db`。
- 数据库镜像：PostgreSQL 使用 `pgvector/pgvector:0.8.3-pg16`。
- 生产 env：`/opt/ai-scale-system/shared/.env.production` 留在服务器，不进入 Git，不打包进 release。
- AI Key：项目侧 provider key 在 `/admin/apikeys` 管理，存入数据库加密字段。
- MCP Key：在 `/admin/mcpkeys` 创建，只用于 `/api/mcp`。
- 生产迁移：禁止 `prisma db push`；只允许备份后执行 `prisma migrate deploy`。
- 生产写库：任何删表、删列、改 enum 的迁移执行前必须先备份。
- 回滚优先级：先回滚应用版本并保留数据库 volume；只有确实需要数据回退时，才恢复已验证的 dump。

## 目录约定

- 当前版本：`/opt/ai-scale-system/current`
- release 目录：`/opt/ai-scale-system/releases/<release-id>`
- Gitee 拉取缓存：`/opt/ai-scale-system/repo-cache`
- 生产 env：`/opt/ai-scale-system/shared/.env.production`
- 数据库备份：`/var/backups/ai-scale-system/postgres`

仓库不保存 `.env`、`.env.local`、`.env.production`、私钥、token、真实数据库 URL、`node_modules`、`.next`、临时文件和构建缓存。

## AI 配置边界

- `.env.production`：数据库、站点 URL、session/admin/business secret、后台管理员、基础开关。
- `/admin/apikeys`：DeepSeek、OpenAI、SiliconFlow、FastGPT、Dify、OneAPI、自定义 OpenAI-compatible 服务等项目侧 AI Provider Key。
- `/admin/agent`：文本模型、ASR、TTS、外部 AI/知识库调试控制台链接和语音参数。
- `/admin/mcpkeys`：外部智能体调用 `/api/mcp` 的 MCP Key。
- 题目解释：通过项目自己的解释 API 调用后台配置的 Provider；AI 失败不影响答题提交。
- 科研与审计：`AiConversationSession` / `AiConversationEvent` 是项目内 source of truth。

## 本地演示

```powershell
npm install
Copy-Item .env.local.example .env.local
npm run dev:services
npm run db:dev:migrate
npm run db:dev:seed
npm run dev
```

本地 Compose 只启动：

- `db`: `pgvector/pgvector:0.8.3-pg16`

## 新服务器首次安装

### 1. 安装基础运行时

```bash
sudo dnf install -y dnf-plugins-core ca-certificates curl gnupg2 nginx firewalld git
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Nginx、域名和 HTTPS 属于服务器入口层，除非有明确变更任务，不应由应用升级脚本修改。

### 2. 获取 Git 确认版本

```bash
sudo mkdir -p /opt/ai-scale-system/releases /opt/ai-scale-system/shared
cd /opt/ai-scale-system
sudo git clone https://gitee.com/lishuaishuai1314520/AIliangbiao.git releases/<release-id>
sudo ln -sfn /opt/ai-scale-system/releases/<release-id> /opt/ai-scale-system/current
```

### 3. 准备生产 env

```bash
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

容器内 `DATABASE_URL` / `DIRECT_URL` 必须指向 `db:5432`，不能指向 `localhost`。

### 4. 首次启动与迁移

```bash
cd /opt/ai-scale-system/current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production build

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d db

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production run --rm --no-deps app npx prisma migrate deploy

APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d app
```

### 5. Smoke check

```bash
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps
curl http://127.0.0.1:3000/api/health
curl https://tongyimohe.cloud/api/health
```

## 日常升级

```bash
cd /opt/ai-scale-system/current
bash scripts/tencent-gitee-upgrade.sh --diff-only
bash scripts/tencent-gitee-upgrade.sh --skip-cleanup
```

升级脚本职责：

- 从 Gitee 拉取指定分支或 commit。
- 生成 release。
- 展示当前版本与目标版本差异。
- 备份数据库。
- 构建 app。
- 执行 `prisma migrate deploy`。
- 重建 app 容器。
- 检查本地和公网 `/api/health`。
- 健康后切换 `/opt/ai-scale-system/current`。
- 保留最近 3 个 release。

## 本次减法迁移提示

`20260702_remove_hermes_neonate_growth` 会删除内置运行层、新生儿病房和 growth 相关表/字段。执行前必须确认备份成功：

```bash
cd /opt/ai-scale-system/current
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres \
bash scripts/docker-db-backup.sh
```

备份成功后再让升级脚本执行 `prisma migrate deploy`。失败时不要切换 `current`。

## MCP 接入

外部平台优先选择：

- URL：`https://tongyimohe.cloud/api/mcp`
- 协议：`streamableHTTP`
- Header：
  - `Authorization: Bearer <MCP_API_KEY>`
  - `Content-Type: application/json`
  - `Accept: application/json, text/event-stream`

MCP Key 从 `/admin/mcpkeys` 创建，不是 AI Provider Key。

## 回滚

查看 release：

```bash
ls -1 /opt/ai-scale-system/releases | tail
readlink -f /opt/ai-scale-system/current
```

回滚应用版本：

```bash
cd /opt/ai-scale-system
sudo ln -sfn /opt/ai-scale-system/releases/<previous-release> current
cd current
APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production up -d --no-deps app
```

数据库回滚必须基于已验证 dump，不能临时猜 SQL。
