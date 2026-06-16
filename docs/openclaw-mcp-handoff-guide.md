# 外部智能体接入与 Web Handoff 指引

本文面向 OpenClaw、FastGPT、Coze、Dify 或其他外部智能体平台，重点解释：

- 什么时候应该用用户态 `agent session + /api/skill/v1/*`
- 什么时候应该用系统态 `/api/mcp`
- 什么时候应该优先切到 Web Handoff
- callback / 轮询 / 结果事实源应该怎么处理

这是一份 how-to 文档，不覆盖部署细节。部署请看 [DEPLOYMENT.md](../DEPLOYMENT.md)。

---

## 先选接入模式

### 模式 A：用户态 Skill Facade

适合：

- 外部智能体挂在已登录患者 / 医生上下文里
- 需要当前成员、医生租户、AI toy 设备绑定等用户态上下文
- 希望与 `/agent`、医生工作台、AI toy 共享同一条会话主链

认证方式：

1. `POST /api/agent/session`
2. 拿到 `agent session token`
3. 用 `Authorization: Bearer <agent_session_token>` 调 `/api/skill/v1/*`

### 模式 B：系统态 MCP

适合：

- 外部平台原生支持 MCP SSE / JSON-RPC
- 只需要系统级工具接入，不要求绑定某个当前登录用户

认证方式：

- `Authorization: Bearer <MCP_API_KEY>`

主入口：

- `GET /api/mcp`
- `POST /api/mcp`

兼容入口：

- `/api/mcp/scale`
- `/api/mcp/memory`
- `/api/mcp/growth`

### 模式 C：Web Handoff

适合：

- 长表单
- 移动端扫码填写
- 聊天线程不适合逐题问答
- 需要把答题 UI 交给浏览器页面

推荐顺序：

1. 如果要绑定当前用户 / 当前成员上下文，优先 `agent session + /api/skill/v1/*`
2. 如果要标准 tool 协议，优先 `/api/mcp`
3. 遇到 `interactionMode = web_handoff` 的量表，优先让用户进入 Handoff 页面

---

## 关键事实源

在这个项目里，有几个边界必须分清：

- `/api/skill/v1/*` 现在使用的是 `agent session token`，不是 `MCP API Key`
- 默认公开量表目录是儿童临床主流程，不是“所有量表”
- 探索量表是独立目录
- AI toy 语音目录当前只包含 `M_CHAT_R` 和 `SNAP-IV`
- `AssessmentSession` 是会话事实源，`AssessmentHistory` 是最终历史沉淀
- `resultDeliveryMode = physician_review` 时，填写端不应该假定能直接看到最终结果

本文所有 `PHQ-9`、`VINELAND_3` 等示例都只是调用格式示例，不代表它们属于同一默认公开目录。

---

## 路线 1：用户态 `agent session` 接入

### 第一步：创建 agent session

```http
POST /api/agent/session
Content-Type: application/json
Authorization: Bearer <context-dependent token>
```

示例 body：

```json
{
  "deviceId": "external-session-001",
  "memberId": "optional-member-id",
  "entrypoint": "agent",
  "clientKind": "app"
}
```

返回值里最重要的是：

- `token`
- `session`
- `account`
- `member`
- `members`

这里的 `Authorization` 不是固定必填，取决于你走哪条上下文链路：

- 已登录患者 / 医生上下文：携带 `app session token`
- AI toy partner 自动建绑：携带 `AI_TOY_PARTNER_TOKEN`
- 纯访客设备：可以不带 `Authorization`，由服务端按 `deviceId` 创建 guest 上下文

### 第二步：调用 skill facade

拿到 `token` 后，后续请求统一使用：

```http
Authorization: Bearer <agent_session_token>
```

常用请求：

```text
GET  /api/skill/v1/scales
GET  /api/skill/v1/scales?category=exploration
GET  /api/skill/v1/scales/:scaleId
POST /api/skill/v1/scales/:scaleId/evaluate
POST /api/skill/v1/scales/:scaleId/sessions
GET  /api/skill/v1/scales/:scaleId/sessions/:sessionId/result
POST /api/skill/v1/voice-intent
```

### 最简单的整表评估

如果你的智能体只需要“读取题目 + 一次性提交答案”：

1. `GET /api/skill/v1/scales/:scaleId`
2. 在自己的对话中收集用户回答
3. `POST /api/skill/v1/scales/:scaleId/evaluate`

示例：

```http
GET /api/skill/v1/scales/PHQ-9?category=exploration
Authorization: Bearer <agent_session_token>
```

```http
POST /api/skill/v1/scales/PHQ-9/evaluate
Authorization: Bearer <agent_session_token>
Content-Type: application/json
```

```json
{
  "answers": [0, 1, 2, 1, 0, 0, 1, 0, 0]
}
```

注意：

- `evaluate` 适合整表一次性提交
- 如果量表的 `resultDeliveryMode` 不是 `immediate`，返回结果可能为 `null`
- 不要让模型自己算分，服务端才是评分事实源

---

## 路线 2：MCP 接入

### canonical MCP

推荐入口：

- `GET /api/mcp`
- `POST /api/mcp`

认证：

- `Authorization: Bearer <MCP_API_KEY>`

最小 JSON-RPC 示例：

```json
{
  "jsonrpc": "2.0",
  "id": "init-1",
  "method": "initialize",
  "params": {}
}
```

```json
{
  "jsonrpc": "2.0",
  "id": "tools-1",
  "method": "tools/list",
  "params": {}
}
```

### 兼容 MCP 入口

如果平台更容易对接单一 skill：

- `GET/POST /api/mcp/scale`
- `GET/POST /api/mcp/memory`
- `GET/POST /api/mcp/growth`

其中 `scale` skill 适合量表推荐、逐题答题与 handoff 编排。

---

## Web Handoff 主链

### 什么时候应该切到 Handoff

以下情况优先走 Handoff：

- 量表本身 `interactionMode = web_handoff`
- 表单太长，不适合在聊天里逐题完成
- 用户更适合在手机浏览器中完成填写
- 你希望聊天线程只做推荐、提醒和结果解释

当前典型 `web_handoff` 量表示例：

- `VINELAND_3`
- `SSS`

### 推荐编排

1. 智能体判断需要做量表
2. 创建会话或生成 handoff link
3. 将 `handoff.url` 或二维码发给用户
4. 用户在浏览器完成填写
5. 智能体通过结果查询继续轮询或在用户说“填完了”后再查询

### 为什么它更稳

- 浏览器页面更适合长表单
- 会话仍落在同一条 `AssessmentSession`
- 不会因为聊天线程漂移而把答题状态搞乱
- callback 可选，轮询也有明确状态机

---

## `generate_assessment_link` / `get_assessment_result`

如果你通过 MCP `scale` skill 编排 Web Handoff，重点关注这两个工具：

- `generate_assessment_link`
- `get_assessment_result`

### `generate_assessment_link` 关注字段

- `session`
- `handoff.url`
- `handoff.qrCodeUrl`
- `completion.status`
- `completion.hasFinalResult`
- `completion.shouldPollResult`
- `completion.pollAfterSeconds`
- `nextAction`
- `callback`

### `completion` 的含义

- `pending`
  - 用户还没完成提交
- `completed`
  - 结果已经生成
- `closed`
  - 会话已取消或过期

- `hasFinalResult = true`
  - 可以把返回结果作为事实源使用

- `shouldPollResult = true`
  - 应按建议节奏继续查询

### 推荐轮询逻辑

1. 生成 handoff link
2. 发给用户
3. 如果 `completion.shouldPollResult = true`，按 `completion.pollAfterSeconds` 节奏轮询
4. 直到 `completion.hasFinalResult = true`
5. 如果 `completion.status = closed`，停止轮询并视为取消或过期

不要只凭“用户说填完了”就假设结果已经存在，仍然要以 `completion` 和最终结果响应为准。

---

## callback / webhook

### 可选参数

在 `generate_assessment_link` 或 `create_assessment_session` 中可传：

- `callbackUrl`
- `callbackSecret`
- `callbackMetadata`

### 回调 payload

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

### 回调 header

- `X-Ailiangbiao-Timestamp`
- `X-Ailiangbiao-Signature`

签名格式：

- `sha256=<hex digest>`

签名原文：

- `${timestamp}.${payloadText}`

### 可靠性

- 提交后立即尝试
- 最多 3 次
- 超过上限进入 `DEAD_LETTER`
- callback 状态可以通过结果查询观察

建议：

- 把轮询作为基线
- 把 webhook 当作增强
- 不要把 webhook 单独当成唯一真相来源

---

## OpenClaw / 外部智能体推荐流程

### Flow A：推荐后直接整表提交

适合短表、探索量表或你自己的对话足够稳定时：

1. 创建 `agent session`
2. `GET /api/skill/v1/scales/:scaleId`
3. 在对话中逐题收集答案
4. `POST /api/skill/v1/scales/:scaleId/evaluate`
5. 使用服务端结果继续解释

### Flow B：推荐后进入 Handoff

适合长表、移动端或 `web_handoff` 量表：

1. 推荐量表
2. 生成 handoff link
3. 让用户去浏览器完成填写
4. 轮询结果或等待用户返回
5. 以服务端结果继续解释

### Flow C：原生 MCP tool orchestration

适合原生支持 MCP 的运行时：

1. `initialize`
2. `tools/list`
3. `tools/call`
4. 如果量表返回 `web_handoff` 或 handoff payload，切换到 Handoff 逻辑

---

## 不要这样做

- 不要把 `/api/skill/v1/*` 当成 `MCP API Key` 接口
- 不要把探索量表误写成默认公开目录
- 不要把 `PHQ-9`、`GAD-7`、`SSS` 当成 AI toy 语音白名单
- 不要让模型自己计算量表得分
- 不要在 `web_handoff` 量表上强行继续 `get_current_question -> submit_answer`
- 不要在 `resultDeliveryMode = physician_review` 时向填写端伪造“已经可见的最终结果”

---

## 进一步阅读

- 根文档：[README.md](../README.md)
- Assessment Skill 包说明：[packages/assessment-skill/README.md](../packages/assessment-skill/README.md)
- 部署说明：[DEPLOYMENT.md](../DEPLOYMENT.md)
