# AI量表系统

全人群心理与健康评测平台。当前项目已经从“单一量表网站”演进为一套以本地确定性评估核心为主、以 MCP/HTTP 能力对外开放、并包含医生/患者协作流程的综合评测系统。

当前线上地址：

- 主站：`https://ailiangbiao.agentpit.io`
- Agent 入口：`https://ailiangbiao.agentpit.io/agent`

---

## 项目定位

当前系统可以理解为三层：

1. Web/UI 层
   - 首页大厅
   - 量表问卷与结果页
   - `/agent` 智能体前台入口
   - 管理后台
   - 医生工作台
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
- MCP 接口说明
- MCP API 密钥管理
- AI 服务商密钥管理
- 系统设置

系统概览现在显示真实数据，不再使用前端 mock 数据。核心聚合接口：

- `GET /api/admin/dashboard`

说明：

- 系统概览已接入真实数据库统计与真实 MCP 日志
- 医生审核、MCP 密钥、AI 服务商密钥与系统设置已接入服务端后台接口
- `用户与成员`、`大模型与计费` 等部分后台页面仍处于过渡态

---

## MCP 与密钥体系

### 1. canonical MCP 入口

正式对外 MCP 入口：

- `GET /api/mcp`
- `POST /api/mcp`

它采用旧版 HTTP + SSE 兼容协议，且现在要求强制鉴权。

接入流程：

1. 使用 `Authorization: Bearer <MCP Key>` 建立 `GET /api/mcp` SSE 会话
2. 从响应头拿到 `X-Session-Id`
3. 后续继续携带同一个 Bearer 凭证，通过 `POST /api/mcp` 发送 JSON-RPC 消息

### 2. 兼容入口

以下端点仍保留，用于历史接入或迁移：

- `/api/mcp/scale`
- `/api/mcp/growth`
- `/api/mcp/memory`

这些兼容入口也都要求 `MCP Key` 鉴权，但它们不再代表默认接入方式。

### 3. MCP Key 与 AI Key 的区别

这是当前项目里一个非常重要的边界：

- `MCP API 密钥`
  - 作用：授权外部智能体访问量表服务
  - 使用位置：`/api/mcp` 与兼容 MCP 路由
  - 不参与任何大模型调用
- `AI 服务商密钥`
  - 作用：调用 OpenAI / DeepSeek / SiliconFlow / Qwen / OneAPI 等模型服务
  - 使用位置：文本生成、语音识别、建议生成等能力
  - 不用于访问 MCP

当前实现上，二者仍共用 `ApiKey` 表，但已经通过 `purpose` 字段强制区分：

- `purpose = AI`
- `purpose = MCP`

相关模型：

- `ApiKey`
- `McpLog`

说明：

- AI 选路只读取 `purpose = AI`
- MCP 鉴权只读取 `purpose = MCP`
- 系统概览中的 MCP 调用次数只统计真实 `tools/call` 成功日志

更多调用顺序说明见：

- `packages/assessment-skill/README.md`

---

## 当前架构

### Web/UI 层

主要目录：

- `app/`
- `components/`
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
- PostgreSQL

### 安装依赖

```bash
npm install
```

### 环境变量

本地开发至少需要这些关键环境变量：

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

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

### Prisma

如果你修改了 `prisma/schema.prisma`：

```bash
npx prisma generate
```

开发库允许重建时可使用：

```bash
npx prisma db push --accept-data-loss
```

如果数据库里已有需要保留的历史字段或生产数据，请不要直接无脑执行 `--accept-data-loss`，应优先采用迁移或定向 SQL 变更。

### 启动 Web/UI

```bash
npm run dev
```

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

- `https://ailiangbiao.agentpit.io`

相关脚本：

- `scripts/redeploy-agent1002.ps1`
- `scripts/remote-redeploy.sh`
- `scripts/remote-migrate-preserve.sh`
- `scripts/tencent-cloud-migrate.py`

如果服务器已经信任 SSH key，可使用：

```powershell
pwsh -File .\scripts\redeploy-agent1002.ps1 -KeyPath C:\path\to\your\id_ed25519
```

更多说明见：

- `docs/redeploy-agent1002.md`

---

## 现阶段取舍

### 已完成

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
- `packages/assessment-skill` skeleton

### 仍在演进

- `packages/assessment-skill` 的 `server` 仍未完全 ports/adapters 解耦
- 旧兼容层 `/api/scales`、`/api/voice-intent`、`/api/triage/session` 仍保留
- 部分管理后台页面仍处于过渡态
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
