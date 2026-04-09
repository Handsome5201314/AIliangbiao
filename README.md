# AI 量表系统

内部运维与持续交付仓库，用于维护 AI 量表系统的应用代码、量表数据、AgentPit 接入层，以及部署脚本与运维文档。

## 项目简介

这是一个基于 Next.js 的多量表评测平台，当前已经覆盖以下能力：

- 多量表评测：内置量表、结构化 JSON 量表、半配置化内容量表并存
- 确定性评分：服务端规则引擎负责评分，不依赖大模型直接算分
- 会话式问卷：量表支持 Assessment Session，会话状态、回退、完成与归档统一处理
- 多成员画像：支持家庭成员档案、历史评估、额度管理与上下文隔离
- 患者/医生/平台三端：支持患者注册、医生注册审核、主治绑定、医生时间线与科研授权
- 隐私与合规：患者注册/升级时支持云端隐私风险知情同意留痕
- 语音与分诊：支持聊天式症状描述、语音转写、量表推荐和语音答题辅助
- AgentPit / MCP 接入：提供公开 `/v1/scales*`、OpenAPI、OAuth 在线体验，以及内部 MCP/skill 入口

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
data/scales/            结构化量表 JSON（如 SSS）
data/scale-content/     半配置化量表内容（题干、解释、fallback、选项文案）
docs/                   运维与量表扩展文档
lib/                    业务逻辑、鉴权、会话引擎、MCP、AgentPit 适配层
packages/assessment-skill/
                        skill 契约与服务层
prisma/                 数据模型
scripts/                部署、排障、校验脚本
types/                  类型补充
```

## 当前量表形态

### 1. 内置量表

- 位于 `lib/schemas/**`
- 评分逻辑保留在 TypeScript 中

### 2. 结构化量表

- 位于 `data/scales/*.json`
- 当前已支持 `Description / Dimension / Data / Diagnosis` 结构
- 例如：`data/scales/sss.json`

### 3. 半配置化内容量表

- 内容位于 `data/scale-content/*.content.json`
- 逻辑位于对应的 `lib/schemas/**.ts`
- 当前已接入：
  - `SRS`
  - `ABC`
  - `SNAP-IV`
  - `CARS`

说明：

- 题干、口语化提问、追问、选项解释优先改 `data/scale-content/*.content.json`
- 分值映射、反向计分、阈值、结论逻辑仍在 TypeScript 中
- 详细维护规则见 [data/scale-content/README.md](./data/scale-content/README.md)

## 核心能力

### 量表与评测

- 支持量表摘要列表与详情懒加载
- 支持量表结果导出、历史归档、AI 建议生成
- 支持带前置患者信息的结构化量表
- 支持 `dimensionResults` 等扩展结果结构

### 会话式评估

- Assessment Session 用于统一管理问卷会话
- 支持：
  - 创建会话
  - 获取当前题
  - 提交答案
  - 返回上一题
  - 取消会话
  - 完成后写入 `AssessmentHistory`

### 成员、患者与医生

- 成员画像与历史评估围绕 `MemberProfile` 隔离
- 正式账号支持患者与医生两类业务身份
- 医生需要审核通过后才能进入医生工作台
- 支持成员级主治医生绑定、科研授权与导出审计

### AgentPit 与 MCP

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

内部能力还包括：

- `/api/mcp`
- `/api/mcp/scale`
- `/api/mcp/memory`
- `/api/mcp/growth`
- `/api/skill/v1/*`

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

如需启用模型与语音相关能力，还需要补充 AI 服务商密钥，详见 [.env.example](./.env.example)。

### 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run content:check
npm run skill:build
npm run skill:start
```

默认访问地址：

- 首页：`http://localhost:3000`
- Agent 工作台：`http://localhost:3000/agent`
- 患者注册：`http://localhost:3000/auth/register`
- 医生注册：`http://localhost:3000/doctor/register`
- 管理后台：`http://localhost:3000/admin/login`

## 关键接口

### 应用侧接口

- `GET /api/scales`
- `GET /api/scales?view=summary`
- `POST /api/scales/evaluate`
- `POST /api/scales/analyze-conversation`
- `POST /api/account/upgrade`
- `POST /api/auth/register-patient`
- `POST /api/auth/register-doctor`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/legal/privacy-consent/current`
- `POST /api/assessment/save`
- `POST /api/assessment/generate-advice`
- `GET|POST|DELETE /api/triage/session`
- `POST /api/speech/transcribe`

### 会话式量表接口

- `POST /api/skill/v1/scales/{scaleId}/sessions`
- `GET /api/skill/v1/scales/sessions/{sessionId}`
- `POST /api/skill/v1/scales/sessions/{sessionId}/answer`
- `POST /api/skill/v1/scales/sessions/{sessionId}/back`
- `POST /api/skill/v1/scales/sessions/{sessionId}/cancel`

### 医生与患者接口

- `GET /api/doctors/search`
- `GET|POST|DELETE /api/me/members/{memberId}/attending-doctor`
- `GET|POST|DELETE /api/me/members/{memberId}/research-consent`
- `GET /api/doctor/me/dashboard`
- `GET /api/doctor/patients`
- `GET /api/doctor/patients/{memberId}`
- `GET /api/doctor/patients/{memberId}/timeline`
- `POST /api/doctor/patients/{memberId}/notes`
- `GET /api/doctor/patients/{memberId}/export`

### 管理端接口

- `GET /api/admin/doctors/pending`
- `POST /api/admin/doctors/{doctorId}/approve`
- `POST /api/admin/doctors/{doctorId}/reject`
- `POST /api/admin/doctors/{doctorId}/suspend`
- `GET /api/admin/research-export-logs`

## 运维与部署入口

详细部署与机器相关流程统一查看以下文档和脚本：

- 通用部署说明：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 指定服务器重复部署说明：[docs/redeploy-agent1002.md](./docs/redeploy-agent1002.md)
- 结构化量表格式说明：[docs/scale-manifest.md](./docs/scale-manifest.md)
- Windows 重部署脚本：[scripts/redeploy-agent1002.ps1](./scripts/redeploy-agent1002.ps1)
- 远端部署脚本：[scripts/remote-redeploy.sh](./scripts/remote-redeploy.sh)

常见运维脚本目录：

- `scripts/deploy*.sh`
- `scripts/check*.mjs`
- `scripts/fix*.mjs`
- `scripts/diagnose*.mjs`
- `scripts/validate-scale-content.mjs`

## 相关文档

- 量表内容维护说明：[data/scale-content/README.md](./data/scale-content/README.md)
- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 行为准则：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- 变更记录：[CHANGELOG.md](./CHANGELOG.md)
- 开源许可：[LICENSE](./LICENSE)

## 注意事项

- 根 README 只保留项目总览，机器、域名、服务器初始化等现场信息请查看运维文档。
- 运行部署脚本前，请先检查其中的域名、主机、路径、密钥和数据库策略是否匹配当前环境。
- `.env`、私钥、证书和真实数据库连接串不要提交到 Git。
- 本系统用于筛查、教育、职业探索和自我了解参考，不替代医生、心理咨询师或职业规划师的正式结论。
