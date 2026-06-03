# AI量表系统

全人群心理与健康评测平台。当前项目已经从“单一量表网站”演进为一套以本地确定性评估核心为主、以 MCP/HTTP 能力对外开放、并包含医生/患者协作流程的综合评测系统。

当前线上地址：

- 主站：`https://tongyimohe.cloud`
- Agent 入口：`https://tongyimohe.cloud/agent`

---

## 项目意义

这个项目的意义，不只是把传统纸质量表搬到线上，而是用 AI 辅助患者完成更高质量、更高完整度的数据采集，再由本地确定性代码完成评分与结果计算，形成一套既适合临床使用、也适合科研沉淀的评测基础设施。

核心价值包括：

- AI 可在采集过程中进行引导、追问、解释与纠偏，帮助患者提供更完整、更高质量的数据。
- 患者在复诊前即可完成标准化信息采集，减少重复问询和往返成本，降低复诊负担。
- 系统能够持续沉淀结构化、可追溯、可复核的数据，为高质量科研数据集建设提供基础。
- 量表评分完全由代码进行确定性计算，而不是由大模型直接算分，结果稳定、可复核、避免评分漂移。
- 对门诊医生而言，系统能显著提升量表采集、整理和解释效率，让医生把更多时间用于判断、沟通和干预。

这也意味着，本项目的核心不是“让 AI 代替医生判断”，而是“让 AI 帮助患者完成高质量数据采集，让代码负责绝对准确的评分，让医生在更高质量的数据基础上做更高效的临床决策”。

---

## 项目定位

当前系统可以理解为三层：

1. Web/UI 层
   - 首页大厅
   - 量表问卷与结果页
   - `/agent` 智能体前台入口
   - 管理后台
   - 医生工作台
   - 基于 shadcn/ui 的统一设计系统
2. Assessment Core 层
   - 量表目录与题目定义
   - 确定性评分引擎
   - assessment session 状态机
   - Growth / 新生儿生长评估
   - 语音分诊与最小成员档案读取
3. Agent / MCP 层
   - 标准 MCP SSE 入口
   - MCP 兼容入口
   - Skill-first HTTP facade
   - 面向外部智能体的安全接入层

---

## 当前能力

### 1. 量表系统

当前同时支持：

- 内置量表：`lib/schemas/**`
- 配置化量表：`data/scales/*.json`

已接入量表：

| 分类 | 量表 | ID | 形态 |
|---|---|---|---|
| 儿童发育 | 孤独症行为评定量表 | `ABC` | 内置 |
| 儿童发育 | 卡氏儿童孤独症评定量表 | `CARS` | 内置 |
| 儿童发育 | 社交反应量表 | `SRS` | 内置 |
| 儿童发育 | 注意缺陷多动障碍筛查量表 | `SNAP-IV` | 内置 |
| 人格测试 | MBTI 职业性格测试 | `MBTI` | 内置 |
| 职业测评 | 霍兰德职业倾向测验量表 | `HOLLAND` | 内置 |
| 成人心理 | 抑郁量表 | `PHQ-9` | 配置化 |
| 成人心理 | 焦虑量表 | `GAD-7` | 配置化 |

### 2. 确定性评分

最终评分始终由服务端规则引擎完成，不让大模型直接算分。

核心位置：

- `lib/scales/catalog.ts`
- `lib/schemas/**`
- `app/api/scales/evaluate`
- `app/api/skill/v1/scales/[scaleId]/evaluate`

### 3. 多成员档案与会话

当前支持多成员档案：

- 本人
- 孩子
- 父母
- 配偶
- 兄弟姐妹
- 其他

相关模型：

- `User`
- `MemberProfile`
- `AssessmentHistory`
- `AssessmentSession`

说明：

- `MemberProfile` 当前仍通过 `@@map("ChildProfile")` 映射历史表名
- `AssessmentHistory` 与 `AssessmentSession` 都已支持 `profileId`
- 当前用户可切换评测对象
- 系统主干只保留评估所需的最小成员档案，不把“用户画像能力”作为核心产品概念

### 4. 语音与智能交互

当前已支持：

- 语音转文本
- `voice-intent` 服务端语义理解
- 分诊推荐量表
- 通话模式 UI
- `No-Input / No-Match`
- `repeat / explain / pause / resume` 元意图

### 5. `/agent` 智能体入口

`/agent` 页面是当前智能体交互入口。

特点：

- 不直接访问数据库
- 先通过 `/api/agent/session` 获取受控 token
- 通过 `/api/skill/v1/*` 访问当前用户/当前成员数据
- 负责推荐、分诊、解释和导流
- 正式答题仍回到现有问卷与 session 流程

### 6. 医生 / 患者链路

当前已经具备：

- 患者注册与登录
- 医生注册与登录
- 医生资质审核后台
- 医生仪表盘
- 医生查看患者列表与详情
- 医生查看患者时间线
- 医生私有备注
- 科研导出

相关入口：

- `POST /api/auth/register-patient`
- `POST /api/auth/register-doctor`
- `POST /api/auth/login`
- `GET /api/doctor/me/dashboard`
- `GET /api/doctor/patients`

### 7. 管理后台

后台已包含：

- 真实系统概览
- 医生审核
- Agent 配置中心
- MCP 监控仪表盘
- MCP API 密钥管理
- AI 服务商密钥管理
- 门诊二维码管理
- 团队管理
- 计费管理
- 系统设置

所有管理后台页面已统一迁移至 shadcn/ui 组件体系（Card、Button、Badge、Input、Dialog、PageHeader 等）。

系统概览现在显示真实数据，不再使用前端 mock 数据。核心聚合接口：

- `GET /api/admin/dashboard`

说明：

- 系统概览已接入真实数据库统计与真实 MCP 日志
- 医生审核、MCP 密钥、AI 服务商密钥与系统设置已接入服务端后台接口

---

## 外部智能体接入

### 接入策略

当前系统支持两种外部接入方式：

1. REST API（主推）— 简单的 HTTP 调用，任何平台都能接
2. MCP（可选）— 标准 MCP 协议，适合原生支持 MCP 的 agent runtime

核心原则：评分引擎是本系统的核心价值，外部智能体只负责对话编排和结果解释，评分必须走本系统代码。

### 1. REST API 接入（推荐）

外部智能体只需两步 HTTP 调用即可完成量表评测：

```
步骤 1：获取量表定义
GET /api/skill/v1/scales/:scaleId
→ 返回题目、选项、评分说明

步骤 2：提交答案获取评分
POST /api/skill/v1/scales/:scaleId/evaluate
→ 提交结构化答案，返回确定性评分结果
```

外部智能体（OpenClaw、FastGPT、Coze、Dify 等）在自己的对话中用自然语言逐题收集用户回答，最后一次性提交到评分端点。

优势：
- 只需 2 次 HTTP 调用，不需要多轮 tool call 编排
- 不依赖 SSE 长连接，不会因为连接断开丢状态
- 任何能发 HTTP 请求的平台都能接入

### 2. Web Handoff 模式（推荐用于移动端）

适合用户在手机上扫码填写的场景：

1. 外部智能体调用 `generate_assessment_link` 生成填写链接
2. 用户在浏览器中完成标准问卷
3. 外部智能体轮询 `get_assessment_result` 获取结果

详细说明见：`docs/openclaw-mcp-handoff-guide.md`

### 2.5 AI 语音玩具接入

适合“小智式”语音玩具：设备连接合作方后台，合作方后台再调用本系统。

绑定流程：

1. 用户在本系统登录或注册患者账号，并选择默认成员档案
2. 合作方后台调用 `POST /api/ai-toy/devices` 绑定 `{ deviceId, memberId }`
3. 每次玩具会话开始时调用 `POST /api/agent/session`，body 带 `deviceId`、`memberId`、`entrypoint: "agent"`、`clientKind: "ai_toy"`，并在请求头带患者账号 token
4. 后续使用返回的 agent token 调 `/api/skill/v1/*`

量表目录：

- `GET /api/skill/v1/scales?aiToy=voiceFriendly`
- 或 `GET /api/skill/v1/scales?voiceFriendly=1`

首版只返回语音友好的白名单量表：`PHQ-9`、`GAD-7`、`SSS`、`M_CHAT_R`、`SNAP-IV`。
评分、会话状态与结果落库仍由本系统完成，玩具后台只负责语音编排和短期会话状态。

### 3. MCP 接入（可选）

MCP 入口保留，适合原生支持 MCP 协议的 agent runtime：

- `GET /api/mcp` — SSE 会话建立
- `POST /api/mcp` — JSON-RPC 消息

接入流程：

1. 使用 `Authorization: Bearer <MCP Key>` 建立 SSE 会话
2. 从响应头拿到 `X-Session-Id`
3. 通过 `POST /api/mcp` 发送 JSON-RPC 消息

兼容入口（历史接入）：

- `/api/mcp/scale`
- `/api/mcp/growth`
- `/api/mcp/memory`

说明：MCP 不再是主推接入方式。多轮 tool call 编排在 FastGPT 等平台上容易出错，建议优先使用 REST API 或 Web Handoff。

### 4. MCP Key 与 AI Key 的区别

- `MCP API 密钥`（`purpose = MCP`）
  - 作用：授权外部智能体访问量表服务
  - 使用位置：REST API、MCP 路由
  - 不参与任何大模型调用
- `AI 服务商密钥`（`purpose = AI`）
  - 作用：调用 OpenAI / DeepSeek / SiliconFlow / Qwen / OneAPI 等模型服务
  - 使用位置：文本生成、语音识别、建议生成等能力
  - 不用于访问量表 API

二者共用 `ApiKey` 表，通过 `purpose` 字段强制隔离。

更多接入细节见：

- `packages/assessment-skill/README.md`
- `docs/openclaw-mcp-handoff-guide.md`

---

## 当前架构

### 设计系统

基于 shadcn/ui（Radix + Tailwind + CVA）构建统一组件库：

- 组件目录：`components/ui/`（Button、Card、Badge、Input、Dialog、Table、Select 等）
- 布局组件：`components/layout/`（SidebarShell、PageHeader）
- 设计令牌：
  - 主色：indigo-600
  - 强调色：cyan-500
  - 中性色：slate 色阶
  - 语义色：emerald（成功）、amber（警告）、rose（错误）
- 圆角风格：rounded-2xl / rounded-3xl（大圆角）
- 字体：Inter + Noto Sans SC

三端（患者、医生、管理员）所有页面已统一迁移至 shadcn/ui 组件体系。

### Web/UI 层

主要目录：

- `app/`
- `components/`
- `components/ui/`（shadcn/ui 组件）
- `components/layout/`（共享布局组件）
- `contexts/`

负责：

- 首页大厅
- 问卷交互
- 结果展示
- 管理后台
- 医生工作台
- `/agent`

### Skill Facade 层

当前统一对外 HTTP 能力位于：

- `app/api/skill/v1/*`

这层是当前 Web/UI 与未来独立 Skill 服务之间的稳定合同层。

### Assessment Core Package

当前已经抽出 package skeleton：

- `packages/assessment-skill`

作用：

- 固化本地量表评估核心边界
- 固化 OpenAPI / MCP manifest
- 固化 auth / token / internal API 工具
- 作为未来独立分仓的起点

当前状态：

- 已能单独 `build`
- 仍依赖宿主应用中的 Prisma client 与本地量表 catalog
- 包内 README 主要承担“外部智能体如何调用 MCP”的说明书角色

### 管理与安全层

当前后台管理接口已经补上服务端管理员校验：

- 登录：`POST /api/admin/login`
- 登出：`POST /api/admin/logout`
- 管理员会话：`httpOnly` cookie

管理员会话与普通应用会话分离：

- 普通用户 / 医生会话：`APP_SESSION_SECRET || SESSION_SECRET`
- 管理员后台会话：`ADMIN_SESSION_SECRET || SESSION_SECRET`

---

## App / Skill Compatibility API

### Agent Session

- `POST /api/agent/session`

作用：

- 用 `deviceId + 当前成员` 创建受控 agent session token

### Scales

- `GET /api/skill/v1/scales`
- `GET /api/skill/v1/scales/:scaleId`
- `POST /api/skill/v1/scales/:scaleId/evaluate`
- `POST /api/skill/v1/scales/:scaleId/analyze-conversation`
- `POST /api/skill/v1/scales/:scaleId/sessions`
- `GET /api/skill/v1/scales/:scaleId/sessions/:sessionId`
- `POST /api/skill/v1/scales/:scaleId/sessions/:sessionId/answer`
- `GET /api/skill/v1/scales/:scaleId/sessions/:sessionId/result`

### Voice / Triage

- `POST /api/skill/v1/voice-intent`
- `POST /api/skill/v1/speech/transcribe`
- `GET /api/skill/v1/me/triage-session`
- `POST /api/skill/v1/me/triage-session`

### Member

- `GET /api/skill/v1/me/members`
- `GET /api/skill/v1/me/members/:memberId/context`
- `GET /api/skill/v1/me/members/:memberId/assessment-summary`
- `POST /api/skill/v1/me/members/:memberId/advice`
- `GET /api/skill/v1/me/members/:memberId/memory-summary`
- `POST /api/skill/v1/me/members/:memberId/memory-notes`

### Profile / Account

- `GET /api/skill/v1/profile/sync`
- `POST /api/skill/v1/profile/sync`
- `POST /api/skill/v1/account/upgrade`
- `GET /api/skill/v1/me/quota`

---

## 用户隔离与成员档案

系统当前设计原则：

- 智能体不能直接读数据库
- 只能通过受控 token 访问 skill facade
- 只能读取“当前用户 + 当前成员”的数据

这样做的目的：

- 方便多设备登录
- 支持多成员切换
- 便于审计
- 便于未来替换不同 agent runtime

---

## 目录结构

```text
app/
  agent/                         # /agent 前台入口
  admin/                         # 管理后台页面
  doctor/                        # 医生工作台
  auth/                          # 登录/注册页面
  clinic/                        # 门诊二维码页面
  api/
    admin/                       # 管理后台接口
    auth/                        # 用户/医生注册登录接口
    doctor/                      # 医生工作流接口
    skill/v1/                    # Skill-first facade
    mcp/                         # MCP 入口与兼容入口
    scales/                      # 兼容层
    voice-intent/                # 兼容层
    triage/session/              # 兼容层
  page.tsx

components/
  ui/                            # shadcn/ui 组件（Button, Card, Badge, Input, Dialog 等）
  layout/                        # 共享布局组件（SidebarShell, PageHeader）
contexts/
lib/
  assessment-skill/
  auth/
  db/
  mcp/
  scales/
  schemas/
  services/

packages/
  assessment-skill/

data/
  scales/

prisma/
  schema.prisma
```

---

## 本地开发

### 环境要求

- Node.js 20+
- npm
- Docker Desktop（推荐）
- PostgreSQL URL 形式的 `DATABASE_URL` / `DIRECT_URL`

### 安装依赖

```bash
npm install
```

### 环境变量

本地和云端保持同一种数据库接入方式：都只使用 PostgreSQL URL 形式的 `DATABASE_URL` / `DIRECT_URL`。

推荐做法：

1. 复制 `.env.local.example` 为 `.env.local`
2. 用本地 PostgreSQL 地址替换密码等敏感值
3. 启动本地数据库容器

最小示例：

```env
DATABASE_URL="postgresql://user:password@127.0.0.1:5432/dbname"
DIRECT_URL="postgresql://user:password@127.0.0.1:5432/dbname"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000"

SESSION_SECRET="your-random-secret"
APP_SESSION_SECRET="optional-app-session-secret"
ADMIN_SESSION_SECRET="optional-admin-session-secret"

ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123456"
```

说明：

- `APP_SESSION_SECRET` 未设置时会回退到 `SESSION_SECRET`
- `ADMIN_SESSION_SECRET` 未设置时也会回退到 `SESSION_SECRET`
- 生产环境建议显式设置两个独立 secret

### 本地数据库

如果你希望本地开发和云端部署保持一致的“PostgreSQL + Prisma URL”模式，直接使用仓库自带的 Docker 开发库：

```bash
copy .env.local.example .env.local
npm run dev:full
```

这会先启动本地依赖服务，再进入 Next 开发模式。

默认会在本机暴露：

- PostgreSQL：`127.0.0.1:5432`
- Hermes API Server：`127.0.0.1:8642`
- Web/UI：`http://localhost:3000`

如果你只想启动依赖服务：

```bash
npm run dev:services
```

如果你只想关闭依赖服务：

```bash
npm run dev:services:down
```

填充一份本地演示数据：

```bash
npm run db:dev:seed
```

这会创建：

- 管理员：`admin / admin987654321`
- 演示医生账号
- 演示患者账号
- 1 个儿童成员档案
- 2 条演示评估记录

### Prisma

如果你修改了 `prisma/schema.prisma`：

```bash
npx prisma generate
```

开发库允许重建时可使用：

```bash
npx prisma db push --accept-data-loss
```

或者：

```bash
npm run db:dev:push
```

如果数据库里已有需要保留的历史字段或生产数据，请不要直接无脑执行 `--accept-data-loss`，应优先采用迁移或定向 SQL 变更。

### 启动 Web/UI

```bash
npm run dev
```

如果你已经使用 `npm run dev:full`，则不需要再单独执行这一条。

访问：

- 主站：`http://localhost:3000`
- Agent：`http://localhost:3000/agent`
- 后台：`http://localhost:3000/admin/login`

### 构建 Web/UI

```bash
npm run build
```

### 构建 Skill Package Skeleton

```bash
npm run skill:build
```

### 启动 Skill Skeleton

```bash
npm run skill:start
```

默认地址：

- `http://127.0.0.1:4318`

当前 standalone skeleton 提供：

- `/healthz`
- `/readyz`
- `/openapi.json`
- `/mcp/manifest.json`

---

## 部署

当前线上环境：

- `https://tongyimohe.cloud`

当前仅保留 Docker 部署链路：

- `scripts/docker-redeploy.py`
- `docker-compose.prod.yml`
- `DEPLOYMENT.md`

从本地覆盖部署到腾讯云生产服务器：

```bash
DEPLOY_PASSWORD='<server-password>' \
python scripts/docker-redeploy.py --host tongyimohe.cloud --user root
```

## Prisma Notes

- This project uses direct PostgreSQL Prisma Client with `postgresql://...` URLs.
- Do not use `npx prisma generate --no-engine`.
- Rebuild Prisma Client with `npm run prisma:generate` or `npx prisma generate`.
- If Windows reports `query_engine-windows.dll.node` is in use, stop the current Next/Node process first, then regenerate.

---

## 现阶段取舍

### 已完成

- shadcn/ui 统一设计系统（组件库 + 设计令牌 + 布局组件）
- 三端（患者、医生、管理员）全部页面 UI 美化与组件迁移
- 全局颜色统一（gray→slate、red→rose、green→emerald）
- 全局导航修复（`<a>` → Next.js `<Link>`）
- Skill-first 前端主链
- `/agent` 智能体入口
- 多成员档案与 assessment session
- 服务端 `voice-intent`
- 通话模式 UI
- 医生 / 患者双注册与医生审核
- 医生工作台、备注、时间线、科研导出
- 管理后台真实系统概览
- MCP Key 与 AI Key 服务端用途隔离
- canonical MCP 强制鉴权
- REST API 主推外部接入 + MCP 可选 + Web Handoff 移动端模式
- `packages/assessment-skill` skeleton

### 仍在演进

- `packages/assessment-skill` 的 `server` 仍未完全 ports/adapters 解耦
- 旧兼容层 `/api/scales`、`/api/voice-intent`、`/api/triage/session` 仍保留
- 仍有一些历史表名与兼容字段需要逐步清理

---

## 免责声明

本系统用于筛查、评估、教育、职业探索与辅助决策支持，不能替代正式医疗诊断或专业临床意见。

如涉及：

- 自伤 / 自杀风险
- 严重精神困扰
- 儿童安全风险
- 明显功能退化

请及时联系医生、心理专业人员或紧急支持资源。

---

## License

[MIT](LICENSE)
