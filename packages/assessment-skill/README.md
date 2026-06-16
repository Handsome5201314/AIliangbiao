# `@ailiangbiao/assessment-skill`

`@ailiangbiao/assessment-skill` 是当前宿主应用对外接入契约的一部分，不是一个已经完全独立部署的产品型 runtime。它承担的职责是：

- 沉淀量表评估核心的稳定公开面
- 暴露宿主应用复用的 server/contracts/routes helper
- 统一 skill facade、MCP 工具与 Web Handoff 的契约说明

当前仓库里它仍依赖：

- 宿主应用中的 Prisma Client
- 宿主应用中的量表目录与评分逻辑
- 宿主应用中的会话、成员、公开 handoff 与 callback 基础设施

---

## 当前定位

请把当前系统拆成两层来理解：

### 宿主应用层

- `Next.js` 页面与 API 路由
- PostgreSQL + Prisma
- `app/api/skill/v1/*`
- `/api/mcp` 与兼容入口
- 公开 handoff 页面与提交接口

### 包暴露层

- server-side auth / scale service helper
- 公开 contracts
- routes / server helper 的可复用入口
- 面向外部接入方的稳定说明书

这意味着：

- 对外“真正跑起来”的服务仍然是宿主应用
- 这个包更像宿主应用里的 Assessment Core / 接入契约抽离层

---

## 稳定公开面

当前建议依赖的公开面：

- `@ailiangbiao/assessment-skill`
- `@ailiangbiao/assessment-skill/routes`
- `@ailiangbiao/assessment-skill/contracts`
- `@ailiangbiao/assessment-skill/server`

当前包内 standalone skeleton 仅用于开发与契约验证，不应被当成完整生产能力来理解。

---

## 鉴权模型

### 1. 用户态 skill facade

`/api/skill/v1/*` 这一组接口使用的是 `agent session token`：

1. 先调用 `POST /api/agent/session`
2. 取得 `agent session token`
3. 用 `Authorization: Bearer <agent_session_token>` 调用 `/api/skill/v1/*`

这组接口不使用 `MCP API Key`。

### 2. 系统态 MCP

`/api/mcp` 以及兼容入口 `/api/mcp/scale`、`/api/mcp/memory`、`/api/mcp/growth` 使用 `MCP API Key`。

两者职责不同：

- `agent session token`：绑定当前用户、当前成员、当前租户上下文
- `MCP API Key`：系统级外部工具协议访问

---

## 量表目录与可见性

量表目录不是单一平铺列表，而是按产品组暴露：

- `all_child`
  - 默认儿童临床主流程
- `exploration`
  - 探索量表
- `voiceFriendlyChild`
  - AI toy 使用的儿童语音白名单

当前事实：

- 默认公开目录不是“所有量表”，而是 `publicClinicalChild`
- 探索量表不会默认混入儿童主流程
- 医生端是否可见探索量表由 `doctorExplorationEnabled` 控制
- AI toy 语音目录当前仅包含 `M_CHAT_R` 与 `SNAP-IV`

---

## 推荐接入方式

### 1. 用户态 REST / Skill Facade

适合：

- `/agent`
- 患者侧或医生侧嵌入式智能体
- AI toy 设备会话
- 需要多成员隔离、用户上下文与租户上下文的接入

主流程：

```text
POST /api/agent/session
  -> 返回 agent session token

GET /api/skill/v1/scales
GET /api/skill/v1/scales/:scaleId
POST /api/skill/v1/scales/:scaleId/evaluate
POST /api/skill/v1/scales/:scaleId/sessions
GET /api/skill/v1/scales/:scaleId/sessions/:sessionId/result
```

### 2. Web Handoff

适合：

- 长表单
- 手机扫码填写
- 需要把填写与当前聊天线程解耦的场景

对于 `interactionMode = web_handoff` 的量表：

1. 创建会话或生成 handoff link
2. 用户在公开表单完成填写
3. 结果仍回写到同一条 `AssessmentSession`
4. 最终产出 `AssessmentHistory`

### 3. MCP

适合：

- 原生支持 MCP SSE / JSON-RPC 的平台
- 需要 tool-based orchestration 的平台

优先使用：

- `GET /api/mcp`
- `POST /api/mcp`

兼容入口：

- `GET/POST /api/mcp/scale`
- `GET/POST /api/mcp/memory`
- `GET/POST /api/mcp/growth`

---

## 常用接口契约

### Skill Facade

- `GET /api/skill/v1/scales`
- `GET /api/skill/v1/scales?category=exploration`
- `GET /api/skill/v1/scales?aiToy=voiceFriendly`
- `GET /api/skill/v1/scales/:scaleId`
- `POST /api/skill/v1/scales/:scaleId/evaluate`
- `POST /api/skill/v1/scales/:scaleId/sessions`
- `GET /api/skill/v1/scales/:scaleId/sessions/:sessionId/result`
- `POST /api/skill/v1/voice-intent`

### Agent Session

- `POST /api/agent/session`

典型用途：

- 当前登录用户为 `/api/skill/v1/*` 获取用户态 token
- `deviceId` 绑定 guest / patient / doctor / ai_toy 渠道上下文
- AI toy partner 在配置 `AI_TOY_PARTNER_TOKEN` 时可使用自动建绑流

### Public Handoff

- `GET /api/assessment/handoff/:token`
- `POST /api/assessment/handoff/:token/submit`

### MCP

- `GET /api/mcp`
- `POST /api/mcp`

---

## Web Handoff 与 callback 契约

Web Handoff 的核心约束：

- `AssessmentSession` 是单一事实源
- public handoff 只是同一会话的一种交互面
- `resultDeliveryMode` 决定填写端是否直接看到结果

可选 callback 参数：

- `callbackUrl`
- `callbackSecret`
- `callbackMetadata`

最终回调 payload 结构：

```json
{
  "eventType": "assessment.completed",
  "sessionId": "session id",
  "deviceId": "external session id or null",
  "scaleId": "VINELAND_3",
  "result": {
    "scaleId": "VINELAND_3",
    "totalScore": 12,
    "conclusion": "example",
    "details": {},
    "assessmentHistoryId": "history id"
  },
  "assessmentHistoryId": "history id",
  "submittedAt": "ISO timestamp",
  "callbackMetadata": {}
}
```

签名 header：

- `X-Ailiangbiao-Timestamp`
- `X-Ailiangbiao-Signature`

签名格式：

- `sha256=<hex digest>`

签名原文：

- `${timestamp}.${payloadText}`

投递行为：

- 提交后立即尝试
- 最多 3 次
- 失败后进入 `DEAD_LETTER`
- callback 状态可以通过结果查询链路观察

---

## 当前限制

- 包内 runtime 仍依赖宿主应用的 Prisma、量表目录与业务服务
- standalone skeleton 更适合作为开发态契约校验，不是完整生产服务
- `/api/scales`、`/api/voice-intent`、`/api/triage/session` 等旧兼容层仍然存在，但主推链路已经转向 skill facade / MCP / handoff
- 量表公开目录、医生目录与 AI toy 目录是三套不同可见性规则，不应混写成一个列表

---

## 进一步阅读

- 根文档：[README.md](../../README.md)
- Handoff 指引：[docs/openclaw-mcp-handoff-guide.md](../../docs/openclaw-mcp-handoff-guide.md)
- 部署说明：[DEPLOYMENT.md](../../DEPLOYMENT.md)
