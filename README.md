# AI量表系统

AI量表系统是面向儿童评估、医生协作、平台知识治理和外部智能体接入的量表平台。系统采用 `Next.js + Prisma + PostgreSQL/pgvector + Hermes`，将量表评分、医生审核、评估记录、智能体接入和平台知识检索放在同一条可追溯数据链路中。

当前公开入口：

- 主站：`https://tongyimohe.cloud`
- Agent 入口：`https://tongyimohe.cloud/agent`

生产部署与运维请以 [DEPLOYMENT.md](./DEPLOYMENT.md) 为准。

## 核心原则

- 量表题目、确定性评分、结果落库和医生审核由本地代码负责。
- AI / 智能体负责推荐、解释、追问、引导填写和外部接入，不绕过医生审核边界。
- 生产发布只来自 Git 仓库中已确认的版本。
- 生产环境变量、数据库 dump、密钥和 token 不进入 Git，也不进入 release 包。
- 生产数据库禁止 `prisma db push`，只能走备份、审查、`prisma migrate deploy` 和经确认的 `prisma migrate resolve`。

## 核心能力

### 患者 / 家属端

- 首页量表大厅，区分儿童临床主流程与探索型量表。
- 多成员档案：同一账号下维护本人、孩子、父母、配偶、兄弟姐妹等成员。
- `/agent` 智能体入口，用于推荐量表、解释问题、驱动会话与导流。
- 公开 Handoff 表单，适合扫码或链接填写长表单。

### 医生工作台

- 医生注册、登录、审核后进入工作区。
- 患者列表、患者详情、时间线、备注、导出。
- 医生邀填、门诊二维码筛查、团队协作与成员授权。
- 新生儿档案、生长记录与黄疸上下文。
- Doctor bot 配置与医生侧对话会话。

### 管理与治理

- 管理员登录与后台概览。
- 医生审核、组织与团队管理。
- Hermes Profile 运行策略管理。
- 平台知识文档、知识审核、审计日志。
- 项目 AI 服务商密钥 / MCP Key / 渠道配置 / 平台策略管理。

### 外部接入

- 用户态 `agent session` + `/api/skill/v1/*`。
- 系统态 `/api/mcp` canonical SSE / JSON-RPC。
- `/api/mcp/scale`、`/api/mcp/memory`、`/api/mcp/growth` 兼容入口。
- AI 玩具设备绑定与 Web Handoff callback。

## 架构拓扑

本地开发：

- `db`: `pgvector/pgvector:0.8.3-pg16`，暴露到 `127.0.0.1:5432`
- `hermes`: `nousresearch/hermes-agent:latest`，暴露到 `127.0.0.1:8642`
- `app`: 本机 `npm run dev`

生产部署：

- `app`: Next.js 应用容器，只监听宿主机 `127.0.0.1:3000`
- `db`: PostgreSQL 16 + pgvector，Docker 内网访问，不对公网开放
- `hermes`: 内部 Hermes Runtime，Docker 内网访问
- 外部入口由服务器已有 Nginx / HTTPS 层转发到 `127.0.0.1:3000`

## AI 控制面与 Hermes 分工

当前实现里，AI 相关能力分成三层：

- 项目自己的智能体 / 业务编排层：负责 ASR/TTS 路由、答案确认、量表入库、确定性评分、报告、权限、审计、fallback 和科研导出。
- 项目 AI 控制面：`/admin/apikeys` 管理项目侧 `text / asr / tts` provider/key/endpoint/model 池，`/admin/agent` 管理 Agent、Hermes 调试链接和语音 adapter 偏好。这一层不会直接改 Hermes 自己的上游模型配置。
- Hermes Runtime：`app` 通过 `HERMES_API_SERVER_BASE_URL`、`HERMES_API_SERVER_KEY`、`HERMES_API_SERVER_MODEL` 调用内部 Hermes API。`HERMES_API_SERVER_KEY` 是 app -> Hermes 的内部鉴权口令，不是 DeepSeek/OpenAI 的服务商 key。
- Hermes 上游模型配置：保存在 Hermes 自己的数据目录（容器内 `/opt/data` 的 `.env` / `config.yaml`）。如果未来要让后台统一切换 Hermes 上游 provider，必须新增显式契约，不能默认复用 `/admin/apikeys`。

家长 Web/H5 纯语音答题第一阶段的数据流是：

1. 浏览器录音后由项目侧 ASR adapter 转写，默认兼容 SiliconFlow SenseVoiceSmall。
2. 项目代码先做本地答案映射；明确的“是 / 不是 / 有 / 没有 / 会 / 不会”可以高置信度映射。
3. “不清楚 / 可能 / 大概 / 偶尔 / 三天转两回 / 说不好”等模糊表达必须进入 Hermes 辅助理解或追问，不直接提交答案。
4. Hermes 只返回候选答案、confidence、evidence、followUpQuestion 和确认需求；最终选项合法性、确认、入库、计分和报告仍由项目代码完成。
5. `AiConversationSession` / `AiConversationEvent` 是 AI 交互和语音逐轮事件的项目内 source of truth，记录 ASR、用户原话、Hermes 映射、确认、fallback、tool call、TTS 和最终答案提交。
6. `/admin/ai-logs` 是超级管理员 AI 会话复盘入口；OpenWebUI / Hermes 控制台只作为新标签页调试链接，不作为正式审计或科研导出数据源。
7. 科研导出从项目数据库读取并默认脱敏，优先导出已确认答案相关事件，不提供原始未脱敏训练集一键导出。

## 目录说明

| 路径 | 说明 |
|---|---|
| `app/` | Next.js App Router 页面和 API route |
| `components/` | 前端组件 |
| `contexts/` | 前端上下文 |
| `lib/scales/` | 量表目录、可见性和产品规则 |
| `lib/schemas/` | 量表题目与确定性评分逻辑 |
| `lib/services/` | doctor、admin、knowledge、agent、AI toy 等服务层 |
| `packages/assessment-skill/` | 外部接入包与 skill facade |
| `prisma/schema.prisma` | 当前数据库 schema source of truth |
| `prisma/migrations/20260627_baseline/` | 当前正式 Prisma baseline migration |
| `prisma/migrations/20260630_parent_voice_ai_control_phase1/` | 家长语音答题与 AI 会话日志第一阶段迁移 |
| `prisma/migrations_archive/pre_20260627_baseline/` | 旧不完整 migration 链归档 |
| `scripts/docker-redeploy.py` | Git 跟踪文件 release + 生产 redeploy 脚本 |
| `docker-compose.dev.yml` | 本地依赖服务 |
| `docker-compose.prod.yml` | 生产三容器拓扑 |
| `DEPLOYMENT.md` | 部署、升级、备份、恢复、回滚手册 |

## 本地一键演示

### 1. 安装依赖

```powershell
npm install
```

### 2. 准备本地 env

```powershell
Copy-Item .env.local.example .env.local
```

### 3. 启动依赖服务

```powershell
npm run dev:services
```

### 4. 初始化数据库

```powershell
npm run db:dev:migrate
npm run db:dev:seed
```

### 5. 启动应用

```powershell
npm run dev
```

常用入口：

- 首页：`http://localhost:3000`
- Agent：`http://localhost:3000/agent`
- 管理后台：`http://localhost:3000/admin/login`

停止依赖服务：

```powershell
npm run dev:services:down
```

## 生产服务器首次安装

首次安装的完整流程见 [DEPLOYMENT.md](./DEPLOYMENT.md#新服务器首次安装)。核心步骤：

1. 安装 Docker Engine 和 Compose plugin。
2. 从 Git 获取已确认版本到 `/opt/ai-scale-system/releases/<release-id>`。
3. 将 `/opt/ai-scale-system/current` 指向该 release。
4. 在服务器创建 `/opt/ai-scale-system/shared/.env.production`。
5. 启动 `db + hermes`。
6. 执行 `prisma migrate deploy` 初始化空库。
7. 启动 `app` 并检查 `/api/health`。

生产 env 永远留在服务器，不进入 Git。
服务器侧 `.env.production` 只放 app -> Hermes 的连接配置与应用密钥，不作为 DeepSeek/OpenAI/OneAPI 的统一控制面。

## 已有生产库升级到新基线

当前正式 baseline：

- `20260627_baseline`

空库可直接：

```bash
npx prisma migrate deploy
```

已有生产库不能直接应用 baseline。必须先完成：

1. 云端只读盘点当前 release、Compose 状态、健康检查、`vector` 扩展和 `_prisma_migrations`。
2. 生产库备份。
3. 本地隔离恢复演练。
4. 确认核心表、用户、医生、评估记录、配置和 `vector` 扩展存在。
5. 本地演练 `prisma migrate resolve --applied 20260627_baseline` + `prisma migrate deploy`。
6. 汇报迁移命令、备份路径和回滚方案，等待确认。

确认后，先用 `--prepare-only` 准备新 release、备份、构建和 pgvector `db` 容器；该模式不会执行 Prisma、不会重建 app、不会切换 `current`。生产库 catch-up 和 baseline resolve 完成后，再执行常规 redeploy。

生产写库前不得跳过人工确认。

## 日常更新

先看云端 diff：

```bash
DEPLOY_PASSWORD='use-env-only' python scripts/docker-redeploy.py --host tongyimohe.cloud --diff-only
```

如服务器使用 SSH key 登录，可改用：

```bash
DEPLOY_KEY_PATH=/path/to/deploy_key python scripts/docker-redeploy.py --host tongyimohe.cloud --diff-only
```

确认后 redeploy：

```bash
DEPLOY_PASSWORD='use-env-only' python scripts/docker-redeploy.py --host tongyimohe.cloud
```

基线化窗口或需要保留旧 release 时，加 `--skip-cleanup`，避免自动删除旧 release 或 prune Docker 镜像/构建缓存。

脚本只打包 Git 跟踪文件，并排除 env、secret、`node_modules`、`.next`、日志和临时文件。脚本会先备份数据库，再构建应用、运行 `prisma migrate deploy`，并在本地和公网健康检查都通过后才切换 `/opt/ai-scale-system/current`。

## 备份、恢复与回滚

手工备份：

```bash
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
DB_BACKUP_DIR=/var/backups/ai-scale-system/postgres \
bash scripts/docker-db-backup.sh
```

恢复数据库会写库，必须在确认窗口执行：

```bash
sudo APP_ENV_FILE=/opt/ai-scale-system/shared/.env.production \
bash scripts/docker-db-restore.sh /path/to/backup.dump
```

回滚优先顺序：

1. 先回滚 app release。
2. 保留当前 PostgreSQL volume。
3. 重新健康检查。
4. 只有确实需要数据回退时，才恢复已验证的 dump。

## 常用验证命令

```powershell
python -m unittest tests.docker_redeploy_test -v
python -m py_compile scripts/docker-redeploy.py
npx prisma validate
npm run ci:check
npm run build
docker compose -f docker-compose.dev.yml --env-file .env.local.example config --quiet
docker compose -f docker-compose.prod.yml --env-file .env.production.example config --quiet
```

## 相关文档

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [packages/assessment-skill/README.md](./packages/assessment-skill/README.md)
- [docs/developmental-behavior-closure/00_PROJECT_BRIEF.md](./docs/developmental-behavior-closure/00_PROJECT_BRIEF.md)

## 免责声明

本系统用于筛查、评估、教育、职业探索与辅助决策支持，不能替代正式医疗诊断或专业临床意见。涉及自伤/自杀风险、严重精神困扰、儿童安全风险或明显功能退化时，应及时联系医生、心理专业人员或紧急支持资源。

## License

[MIT](./LICENSE)
