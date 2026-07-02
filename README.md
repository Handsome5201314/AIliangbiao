# AI量表系统

AI量表系统是面向儿童发育与行为筛查的量表平台。当前项目已收口到量表主业务：量表目录、门诊二维码、家长/患者 H5 答题、医生复核、正式报告、后台治理、AI Provider 配置和 MCP 外部工具接入。

当前公开入口：

- 主站：`https://tongyimohe.cloud`
- Agent 入口：`https://tongyimohe.cloud/agent`
- MCP 入口：`https://tongyimohe.cloud/api/mcp`

生产部署与运维请以 [DEPLOYMENT.md](./DEPLOYMENT.md) 为准。

## 核心原则

- 量表题目、选项、确定性评分、结果落库、医生复核和正式报告由项目代码负责。
- AI 只用于推荐、解释、ASR/TTS、知识库问答和辅助引导，不直接改答案、不提交答案、不绕过医生审核。
- 超级管理员后台统一管理项目侧 AI Provider/API Key、MCP Key、策略、审计和日志。
- 生产发布只来自 Git/Gitee 仓库中已确认版本。
- 生产 `.env.production`、数据库 dump、密钥和 token 不进入 Git，也不进入 release 包。
- 生产数据库禁止 `prisma db push`，只允许备份后执行 `prisma migrate deploy`。

## 核心能力

### 家长 / 患者端

- 首页量表大厅。
- 多成员档案。
- H5 一题一页答题体验。
- 题目解释以下方弹出层展示，由后台配置的通用 AI/知识库接口提供。
- 门诊二维码扫码后进入手机版筛查页面；提交后进入医生复核流程。

### 医生端

- 医生注册、登录和审核。
- 患者列表、患者详情、时间线、备注、导出。
- 医生邀填、门诊二维码筛查、团队协作与患者授权。
- 医生端手机和电脑端保持干净原题，一道题一个页面。
- Doctor bot / 工作台保留为项目侧编排能力，不接管量表裁决。

### 管理后台

- 医生审核、组织与团队管理。
- 平台知识文档、知识审核、审计日志。
- AI 服务商密钥：`/admin/apikeys`。
- Agent/ASR/TTS/调试链接配置：`/admin/agent`。
- AI 会话日志：`/admin/ai-logs`。
- MCP Key 管理：`/admin/mcpkeys`。
- MCP 状态与调用统计：`/admin/mcp`。

### 外部接入

- 用户态 `agent session` + `/api/skill/v1/*`。
- 系统态 `/api/mcp`，优先使用 `streamableHTTP`。
- 兼容入口：`/api/mcp/scale`、`/api/mcp/memory`。
- MCP Key 从后台 `/admin/mcpkeys` 创建，不使用 DeepSeek/OpenAI key、服务器密码或 AI Provider key。

## 架构拓扑

本地开发：

- `db`: `pgvector/pgvector:0.8.3-pg16`，暴露到 `127.0.0.1:5432`
- `app`: 本机 `npm run dev`

生产部署：

- `app`: Next.js 应用容器，只监听宿主机 `127.0.0.1:3000`
- `db`: PostgreSQL 16 + pgvector，Docker 内网访问，不对公网开放
- 外部入口由服务器已有 Nginx / HTTPS 层转发到 `127.0.0.1:3000`

## AI 配置边界

- `.env.production` 只放应用运行、数据库、session、后台管理员、加密密钥和可选基础集成配置。
- DeepSeek、OpenAI、SiliconFlow、FastGPT、Dify、OneAPI、自定义 OpenAI-compatible 服务等项目侧 AI Key 首次登录后在 `/admin/apikeys` 配置。
- `/admin/agent` 只选择 provider/model 偏好、ASR/TTS 参数和外部 AI/知识库调试控制台链接。
- 题目解释通过项目自己的解释 API 调用后台配置的 Provider；AI 失败时显示错误或标准解释，不影响答题提交。
- `AiConversationSession` / `AiConversationEvent` 是语音、解释、确认、fallback、TTS 和最终答案提交轨迹的项目内 source of truth。

## 目录说明

| 路径 | 说明 |
|---|---|
| `app/` | Next.js App Router 页面和 API route |
| `components/` | 前端组件 |
| `contexts/` | 前端上下文 |
| `lib/scales/` | 量表目录、可见性和产品规则 |
| `lib/schemas/` | 量表题目与确定性评分逻辑 |
| `lib/services/` | doctor、admin、knowledge、agent、AI Provider 等服务层 |
| `packages/assessment-skill/` | 外部接入包与 skill facade |
| `skills/ailiangbiao-mcp/` | 可上传到 Agent Skill 平台的 MCP skill 文件夹 |
| `prisma/schema.prisma` | 当前数据库 schema source of truth |
| `prisma/migrations/` | 正式 Prisma migration 链 |
| `scripts/tencent-gitee-upgrade.sh` | 腾讯云从 Gitee 一键升级脚本 |
| `docker-compose.dev.yml` | 本地依赖服务 |
| `docker-compose.prod.yml` | 生产 app + db 拓扑 |
| `DEPLOYMENT.md` | 部署、升级、备份、恢复、回滚手册 |

## 本地一键演示

```powershell
npm install
Copy-Item .env.local.example .env.local
npm run dev:services
npm run db:dev:migrate
npm run db:dev:seed
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

## 腾讯云一键升级

腾讯云生产更新推荐使用 Gitee 镜像仓库作为发布源：

- Gitee：`https://gitee.com/lishuaishuai1314520/AIliangbiao.git`
- 服务器侧一键升级脚本：`scripts/tencent-gitee-upgrade.sh`

```bash
cd /opt/ai-scale-system/current
bash scripts/tencent-gitee-upgrade.sh --diff-only
bash scripts/tencent-gitee-upgrade.sh --skip-cleanup
```

升级流程会执行：拉取 Gitee 确认版本、生成 release、显示 diff、备份数据库、构建 app、`prisma migrate deploy`、重建 app、健康检查、切换 `current`、保留最近 3 个 release。

## 验证命令

```powershell
git diff --check
npx prisma validate
npm test
npm run build
```

云端验证：

```bash
docker compose -f docker-compose.prod.yml --env-file /opt/ai-scale-system/shared/.env.production ps
curl http://127.0.0.1:3000/api/health
curl https://tongyimohe.cloud/api/health
```
