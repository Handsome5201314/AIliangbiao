# AI量表系统

面向儿童评估、医生协作与外部智能体接入的量表平台。当前仓库已经不再是“单一量表网站”，而是一套围绕 `Next.js + PostgreSQL + Hermes` 运行的综合评估系统：前端负责患者、医生、管理员与 `/agent` 交互面，评估核心由本地确定性代码完成，外部接入通过 agent session、MCP 与 Web Handoff 三条链路提供。

当前公开入口：

- 主站：`https://tongyimohe.cloud`
- Agent 入口：`https://tongyimohe.cloud/agent`

相关文档：

- 外部接入包说明：[packages/assessment-skill/README.md](./packages/assessment-skill/README.md)
- OpenClaw / 外部智能体 Handoff 指引：[docs/openclaw-mcp-handoff-guide.md](./docs/openclaw-mcp-handoff-guide.md)
- 生产部署说明：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 配置化量表 Manifest 说明：[docs/scale-manifest.md](./docs/scale-manifest.md)
- 儿童发育行为健康促进闭环 Phase 0 文档包：[docs/developmental-behavior-closure/00_PROJECT_BRIEF.md](./docs/developmental-behavior-closure/00_PROJECT_BRIEF.md)

---

## 项目概览

这个项目的核心不是“让大模型替医生下结论”，而是把职责拆清楚：

- AI / 智能体负责推荐、解释、追问、引导填写与多端接入。
- 量表题目、确定性评分、结果落库与可追溯会话全部由本地代码负责。
- 儿童主流程、医生工作台、门诊邀填、AI 玩具、外部平台接入共用同一套 `AssessmentSession` / `AssessmentHistory` 主链。
- Hermes 负责知识代理、组织/医生画像与平台知识治理，不替代量表评分引擎。

---

## 核心能力地图

### 1. 患者 / 家属端

- 首页量表大厅，区分儿童临床主流程与探索型量表。
- 多成员档案：同一账号下可维护本人、孩子、父母、配偶、兄弟姐妹等成员。
- `/agent` 智能体入口，用于推荐量表、解释问题、驱动会话与导流。
- 公开 Handoff 表单：适合手机扫码或链接填写的长表单流程。

### 2. 医生工作台

- 医生注册、登录、审核后进入专属工作区。
- 患者列表、单个患者详情、时间线、备注、导出。
- 医生邀填与门诊二维码筛查流程。
- 协作团队与成员授权。
- 新生儿档案、生长记录与黄疸上下文。
- doctor bot 配置与医生侧对话会话。

### 3. 管理与治理

- 管理员登录与后台概览。
- 医生审核、组织与团队管理。
- Hermes profile 管理。
- 平台知识文档、知识审核、审计日志。
- API Key / MCP Key / 渠道配置 / 平台策略管理。
- `doctorExplorationEnabled` 等目录可见性策略。

### 4. 外部接入

- 用户态 `agent session` + `/api/skill/v1/*`。
- 系统态 `/api/mcp` canonical SSE / JSON-RPC 入口。
- `/api/mcp/scale`、`/api/mcp/memory`、`/api/mcp/growth` 兼容入口。
- AI 玩具设备绑定与 AI toy partner 自动建绑流。
- Web Handoff callback 回推。

---

## 量表产品规则

### 目录分层

当前量表目录不是“所有量表平铺公开”，而是按产品组分层：

- 默认公开目录：`publicClinicalChild`
  - 面向儿童临床主流程，来自 `clinical_child + isPediatric + defaultVisible`
- 探索量表目录：`exploration`
  - 独立展示，不混入儿童主流程
- 医生目录：`doctorVisible`
  - 默认始终可见儿童临床量表
  - 是否额外可见探索量表，取决于平台策略 `doctorExplorationEnabled`
- AI toy 语音目录：`voiceFriendlyChild`
  - 仅允许儿童临床且语音友好的白名单

默认策略来自 [lib/scales/catalog.ts](./lib/scales/catalog.ts) 与 [lib/services/admin-policies.ts](./lib/services/admin-policies.ts)，当前 `doctorExplorationEnabled` 默认值为 `false`。

### 当前儿童临床主流程量表

| ID | 分组 | 交互模式 | 结果模式 |
|---|---|---|---|
| `ABC` | 儿童临床 | `voice_guided` | `physician_review` |
| `ATEC` | 儿童临床 | `voice_guided` | `physician_review` |
| `CARS` | 儿童临床 | `manual_only` | `physician_review` |
| `M_CHAT_R` | 儿童临床 | `voice_guided` | `physician_review` |
| `SRS` | 儿童临床 | `manual_only` | `physician_review` |
| `SNAP-IV` | 儿童临床 | `voice_guided` | `physician_review` |
| `CBCL_113` | 儿童临床 | `manual_only` | `immediate` |
| `TAS_37` | 儿童临床 | `voice_guided` | `immediate` |
| `VINELAND_3` | 儿童临床 | `web_handoff` | `physician_review` |

### 当前探索量表

| ID | 分组 | 交互模式 | 结果模式 |
|---|---|---|---|
| `PSQI_18` | 探索 | `voice_guided` | `immediate` |
| `RSES_10` | 探索 | `voice_guided` | `immediate` |
| `MMSE_30` | 探索 | `manual_only` | `immediate` |
| `MoCA_30` | 探索 | `manual_only` | `immediate` |
| `MBTI` | 探索 | `full_voice` | `immediate` |
| `HOLLAND` | 探索 | `full_voice` | `immediate` |
| `GAD-7` | 探索 | `full_voice` | `immediate` |
| `PHQ-9` | 探索 | `full_voice` | `immediate` |
| `SSS` | 探索 | `web_handoff` | `immediate` |

### AI toy 语音白名单

当前 AI toy 语音量表目录只返回：

- `M_CHAT_R`
- `SNAP-IV`

它不再包含 `PHQ-9`、`GAD-7`、`SSS`。如需调用该目录，应使用：

- `GET /api/skill/v1/scales?aiToy=voiceFriendly`
- 或 `GET /api/skill/v1/scales?voiceFriendly=1`

---

## 接入方式

### 1. 用户态接入：`/api/agent/session` + `/api/skill/v1/*`

这是当前 Web / `/agent` / 医生工作台 / AI toy 共享的用户态能力入口。

基本流程：

1. 先调用 `POST /api/agent/session`
2. 拿到返回的 `agent session token`
3. 用 `Authorization: Bearer <agent_session_token>` 调用 `/api/skill/v1/*`

这一组接口不是用 `MCP API Key` 鉴权，而是用 `agent session token` 鉴权。

常用路径：

- `GET /api/skill/v1/scales`
- `GET /api/skill/v1/scales/:scaleId`
- `POST /api/skill/v1/scales/:scaleId/evaluate`
- `POST /api/skill/v1/scales/:scaleId/sessions`
- `GET /api/skill/v1/scales/:scaleId/sessions/:sessionId/result`
- `POST /api/skill/v1/voice-intent`
- `GET /api/skill/v1/me/members`
- `GET /api/skill/v1/me/members/:memberId/context`

`POST /api/agent/session` 的前置上下文支持三类场景：

- 已登录患者 / 医生账号：携带 app session Bearer token
- 未登录设备访客：按 `deviceId` 自动分配 guest 用户与默认成员
- AI toy partner：可通过 `AI_TOY_PARTNER_TOKEN` 走自动建绑流

### 2. 系统态接入：`/api/mcp`

当接入方需要标准 MCP SSE / JSON-RPC 能力时，使用 canonical 入口：

- `GET /api/mcp`：建立 SSE 会话
- `POST /api/mcp`：发送 JSON-RPC 消息

这组接口使用 `MCP API Key` 鉴权，与用户态 `agent session token` 完全分离。

兼容入口仍保留：

- `/api/mcp/scale`
- `/api/mcp/memory`
- `/api/mcp/growth`

建议优先级：

1. 用户态多成员/医生/AI toy 场景：`/api/agent/session` + `/api/skill/v1/*`
2. 外部平台需要标准工具协议时：`/api/mcp`
3. 历史兼容平台：`/api/mcp/scale` 等兼容入口

### 3. Web Handoff

对 `interactionMode = web_handoff` 的量表，推荐用 Web Handoff：

1. 生成会话或 handoff 链接
2. 用户在浏览器完成公开表单
3. 结果仍然写回同一条 `AssessmentSession`
4. 最终沉淀为 `AssessmentHistory`

当前公开 handoff 页面与提交接口：

- `GET /assessment/handoff/:token`
- `GET /api/assessment/handoff/:token`
- `POST /api/assessment/handoff/:token/submit`

是否允许填写者直接看到结果，取决于量表的 `resultDeliveryMode`：

- `immediate`：可在填写端看到结果
- `physician_review`：填写端不直接暴露最终结果

### 4. AI 玩具接入

患者账号绑定设备：

- `POST /api/ai-toy/devices`

设备进入用户态智能体链路：

- `POST /api/agent/session`
  - `clientKind: "ai_toy"`
  - `deviceId`
  - 可选 `memberId`
  - 可选 `autoCreateBinding: true`

AI toy 场景仍然使用用户态 `agent session token` 访问 `/api/skill/v1/*`，不是直接拿 `MCP API Key` 调 skill facade。

---

## 系统架构与数据流

### 运行拓扑

- Web/UI：Next.js App Router
- 评估存储：PostgreSQL + Prisma
- 知识与代理依赖：Hermes API Server

本地开发容器：

- PostgreSQL：`127.0.0.1:5432`
- Hermes：`127.0.0.1:8642`
- Web/UI：`http://localhost:3000`

### 主要代码边界

- `app/`
  - 患者端、医生端、管理后台、`/agent`、公开 handoff 页面
- `app/api/`
  - Web/API 入口、doctor/admin 路由、skill facade、MCP、handoff、AI toy
- `lib/scales/` 与 `lib/schemas/`
  - 量表目录、题目定义、确定性评分逻辑、可见性与结果模式
- `lib/services/`
  - doctor bot、门诊筛查、知识治理、Hermes profile、AI toy、协作授权等服务
- `packages/assessment-skill/`
  - 对外接入契约、服务端 helper、稳定公开面
- `prisma/schema.prisma`
  - 用户、成员、评估历史、会话、医生协作、知识治理、AI toy 绑定等核心模型

### 核心数据流

#### 量表评估

1. 前端或外部智能体确定成员与量表
2. 服务端创建 `AssessmentSession`
3. 用户态 skill / MCP / public handoff 三种交互方式之一推进答题
4. 服务端确定性评分
5. 写入 `AssessmentHistory`
6. 按 `resultDeliveryMode` 决定填写端是否直接可见

#### 知识与解释

1. 组织或医生侧 Hermes profile 提供租户上下文
2. 平台知识文档与审核流维护可用知识源
3. 解释/问答链路在 tenant 隔离与平台策略下运行

---

## 本地开发

### 环境要求

- Node.js 20+
- npm
- Docker Desktop

### 1. 安装依赖

```powershell
npm install
```

### 2. 准备环境变量

```powershell
Copy-Item .env.local.example .env.local
```

需要重点检查：

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `APP_SESSION_SECRET`
- `ADMIN_SESSION_SECRET`
- `HERMES_API_SERVER_BASE_URL`
- `HERMES_API_SERVER_KEY`
- `HERMES_API_SERVER_MODEL`
- `PLATFORM_KNOWLEDGE_EMBEDDING_*`

### 3. 启动依赖服务

```powershell
npm run dev:services
```

或一键拉起依赖并进入 Next 开发模式：

```powershell
npm run dev:full
```

停止依赖服务：

```powershell
npm run dev:services:down
```

### 4. 推送 schema 与填充演示数据

```powershell
npm run db:dev:push
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

### 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动 Next.js 开发环境 |
| `npm run build` | 生产构建 |
| `npm test` | 运行根目录测试 |
| `npm run ci:check` | Prisma 校验 + 测试 |
| `npm run smoke:local` | 本地 smoke 检查 |
| `npm run test:e2e:playwright` | Playwright E2E |
| `npm run skill:build` | 构建 `packages/assessment-skill` |
| `npm run skill:start` | 启动包内 standalone skeleton |

---

## 部署入口

生产部署基于 `docker-compose.prod.yml`，完整步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

关键点：

- 生产容器包括 `app`、`db`、`hermes`
- App 仅在宿主机回环口监听 `127.0.0.1:3000`
- 外部入口由宿主机 Nginx 反代 `80/443`
- 数据库保持在 Docker 内网中，不对公网开放 `5432`

生产环境变量模板见：

- [.env.production.example](./.env.production.example)

---

## 免责声明

本系统用于筛查、评估、教育、职业探索与辅助决策支持，不能替代正式医疗诊断或专业临床意见。

如涉及以下场景，请及时联系医生、心理专业人员或紧急支持资源：

- 自伤 / 自杀风险
- 严重精神困扰
- 儿童安全风险
- 明显功能退化

---

## License

[MIT](./LICENSE)
