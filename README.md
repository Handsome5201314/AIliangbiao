# AI 量表系统

内部运维与持续交付仓库，用于维护 AI 量表系统的应用代码、量表数据、AgentPit 接入层，以及部署脚本与运维文档。

## 项目简介

这个项目是一个基于 Next.js 的多量表评测平台，当前聚焦于以下能力：

- 多量表管理：内置量表与 `data/scales/*.json` 配置化量表并存
- 家庭成员档案：支持多成员资料、历史评估与额度管理
- 语音分诊：支持聊天式症状描述、量表推荐与语音转写
- 确定性评分：服务端规则引擎负责评分，不依赖模型直接算分
- AgentPit 接入：提供公开 `OpenAPI`、`/v1/scales*` 入口和 OAuth 在线体验链路
- MCP 能力：保留内部 MCP 路由与技能接口，便于后续平台对接

## 技术栈

- Next.js 16
- React 19
- TypeScript 6
- Prisma 5
- PostgreSQL
- Tailwind CSS
- `@modelcontextprotocol/sdk`

## 目录结构

```text
app/                    Next.js App Router 页面与 API
components/             前端组件
contexts/               前端状态上下文
data/scales/            配置化量表 JSON
docs/                   运维与量表扩展文档
lib/                    业务逻辑、鉴权、MCP、AgentPit 适配层
packages/assessment-skill/
                        抽离中的 skill 契约与服务层
prisma/                 数据模型
scripts/                部署、排障、环境检查脚本
types/                  类型补充
```

## 核心能力

### 量表与评测

- 内置量表位于 `lib/schemas/**`
- 配置化量表位于 `data/scales/*.json`
- 目前已覆盖儿童发育、成人心理、人格测试、职业测评等方向
- 评分通过服务端确定性逻辑完成，评测结果可落库

### 成员与额度

- 角色：`GUEST` / `REGISTERED` / `VIP`
- 支持多成员资料切换
- 游客与注册用户拥有不同每日评测额度
- 评测、分诊、长期记忆都围绕当前成员进行隔离

### AgentPit 接入

公开接入入口：

- `GET /openapi.json`
- `GET /healthz`
- `GET /v1/scales`
- `GET /v1/scales/{scaleId}`
- `POST /v1/scales/{scaleId}/evaluate`
- `POST /v1/scales/{scaleId}/analyze-conversation`
- `GET /api/agentpit/oauth/start`
- `GET /api/agentpit/oauth/callback`

在线体验入口：

- `/agent`

公开 `/v1/*` 接口使用共享 Bearer 鉴权：

```http
Authorization: Bearer <AGENTPIT_SHARED_BEARER>
```

## 本地开发

### 环境要求

- Node.js 20+
- npm
- PostgreSQL

### 安装依赖

```bash
npm install
```

### 最小环境变量

复制 `.env.example` 到 `.env` 后，至少配置以下内容：

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000"
SESSION_SECRET="your-local-secret"

ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123456"

AGENTPIT_SHARED_BEARER="your-agentpit-shared-bearer"
AGENTPIT_CLIENT_ID="your-agentpit-client-id"
AGENTPIT_CLIENT_SECRET="your-agentpit-client-secret"
AGENTPIT_OAUTH_BASE_URL="https://api.agentpit.io"
AGENTPIT_OAUTH_REDIRECT_URI="https://ailiangbiao.agentpit.io/api/agentpit/oauth/callback"
```

如果要启用模型与语音相关能力，还需要补充 AI 服务商密钥，详见 [.env.example](./.env.example)。

### 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run skill:build
npm run skill:start
```

默认访问地址：

- 首页：`http://localhost:3000`
- Agent 工作台：`http://localhost:3000/agent`
- 管理后台：`http://localhost:3000/admin/login`

## 运维与部署入口

详细部署与机器相关流程不再写在首页，统一查看以下文档和脚本：

- 通用部署说明：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 指定服务器重复部署说明：[docs/redeploy-agent1002.md](./docs/redeploy-agent1002.md)
- 配置化量表清单格式：[docs/scale-manifest.md](./docs/scale-manifest.md)
- Windows 重部署脚本：[scripts/redeploy-agent1002.ps1](./scripts/redeploy-agent1002.ps1)
- 远端部署脚本：[scripts/remote-redeploy.sh](./scripts/remote-redeploy.sh)

常见运维脚本目录：

- `scripts/deploy*.sh`
- `scripts/check*.mjs`
- `scripts/fix*.mjs`
- `scripts/diagnose*.mjs`

## 关键接口

### 应用侧接口

- `GET /api/scales`
- `POST /api/scales/evaluate`
- `POST /api/scales/analyze-conversation`
- `GET /api/profile/sync`
- `POST /api/profile/sync`
- `POST /api/account/upgrade`
- `GET /api/quota/check`
- `POST /api/assessment/save`
- `POST /api/assessment/generate-advice`
- `GET|POST|DELETE /api/triage/session`
- `POST /api/speech/transcribe`

### MCP 接口

- `POST /api/mcp`
- `GET|POST /api/mcp/scale`
- `GET|POST /api/mcp/memory`
- `GET|POST /api/mcp/growth`

## 相关文档

- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 行为准则：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- 变更记录：[CHANGELOG.md](./CHANGELOG.md)
- 开源许可：[LICENSE](./LICENSE)

## 注意事项

- 根 README 只保留项目总览，机器、域名、服务器初始化等现场信息请查看运维文档。
- 运行部署脚本前，请先检查其中的域名、主机、路径、密钥和数据库策略是否匹配当前环境。
- `.env`、私钥、证书和真实数据库连接串不要提交到 Git。
- 本系统仅用于筛查、教育、职业探索和自我了解参考，不替代医生、心理咨询师或职业规划师的正式结论。
