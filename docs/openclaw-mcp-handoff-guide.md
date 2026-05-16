# 外部智能体接入量表系统说明书

## 目标

这份说明书面向 OpenClaw 或其他外部智能体（FastGPT、Coze、Dify 等），说明如何调用当前项目的量表能力。

推荐把当前项目视为：

- 量表工具执行层
- 确定性评分引擎
- 会话状态机
- 评分与结果落库层
- handoff 链接 / 二维码分发层

推荐把外部智能体视为：

- 对话主脑
- 任务编排层
- 结果解释与知识库分析层

一句话：

- 外部智能体决定何时推荐量表、用自然对话收集用户回答
- 本项目负责提供标准题目、执行确定性评分、保存结果
- 外部智能体再拿结构化结果继续分析

---

## 推荐调用方式（按优先级排序）

### 最推荐：REST API 两步调用

适合：

- 任何能发 HTTP 请求的平台
- 不想处理 SSE 长连接或多轮 tool call
- 希望最快跑通集成

主流程：

```
步骤 1：获取量表定义
GET /api/skill/v1/scales/:scaleId
Authorization: Bearer <MCP_API_KEY>
→ 返回题目、选项、评分规则说明

步骤 2：提交答案获取评分
POST /api/skill/v1/scales/:scaleId/evaluate
Authorization: Bearer <MCP_API_KEY>
Content-Type: application/json
Body: { "answers": [0, 1, 2, 3, ...] }
→ 返回确定性评分结果
```

外部智能体在自己的对话中用自然语言逐题收集用户回答，映射为选项分数数组，最后一次性提交。

优势：
- 只需 2 次 HTTP 调用
- 不依赖 SSE 长连接
- 不需要维护 sessionId 状态
- 任何平台都能接

### 推荐：Web Handoff 邀填模式

适合：

- OpenClaw 对外聊天
- 用户在手机上扫码或点链接填写
- 希望像“医生邀填”一样稳定
- 不希望 OpenClaw 逐题调用工具

主流程：

1. OpenClaw 调 `generate_assessment_link`
2. 把 `handoff.url` 或 `handoff.qrCodeUrl` 发给用户
3. 用户在 public handoff 页面完成填写
4. OpenClaw 轮询 `get_assessment_result`
5. 拿到结构化结果后，再做解释与建议

### 不推荐：MCP 逐题主控模式

虽然当前工具层支持：

- `create_assessment_session`
- `get_current_question`
- `submit_answer`
- `get_assessment_result`

但不建议让 OpenClaw 长时间逐题主控填写，原因是：

- 多轮会话更容易漂移
- 容易丢 `deviceId / sessionId`
- 用户答非所问时更容易状态错位
- 长链路工具调用比 handoff 模式更脆弱

如果只是外部智能体集成，优先用 handoff。

---

## 接口入口

### REST API（主推）

- `GET /api/skill/v1/scales` — 获取所有量表列表
- `GET /api/skill/v1/scales/:scaleId` — 获取单个量表定义（题目、选项）
- `POST /api/skill/v1/scales/:scaleId/evaluate` — 提交答案，获取确定性评分

认证方式：

- `Authorization: Bearer <MCP_API_KEY>`

### MCP 入口（可选）

当前兼容入口：

- `POST /api/mcp/scale`
- `GET /api/mcp/scale`

其中：

- `GET` 可查看服务状态和工具列表摘要
- `POST` 用 JSON-RPC 方式调用工具

认证方式：

- `Authorization: Bearer <MCP_API_KEY>`

注意：

- 这里的 MCP Key 应和普通 AI Key 分离
- 外部智能体只应拿 MCP 专用密钥

---

## JSON-RPC 基本格式

### 初始化

```json
{
  "jsonrpc": "2.0",
  "id": "init-1",
  "method": "initialize",
  "params": {}
}
```

### 获取工具列表

```json
{
  "jsonrpc": "2.0",
  "id": "tools-1",
  "method": "tools/list",
  "params": {}
}
```

### 调用工具

```json
{
  "jsonrpc": "2.0",
  "id": "call-1",
  "method": "tools/call",
  "params": {
    "name": "generate_assessment_link",
    "arguments": {
      "deviceId": "external-session-001",
      "scaleId": "PHQ-9",
      "language": "zh"
    }
  }
}
```

---

## OpenClaw 推荐使用的工具

### REST API 模式（最简单）

1. `GET /api/skill/v1/scales` — 列出所有可用量表
2. `GET /api/skill/v1/scales/:scaleId` — 获取量表题目与选项
3. `POST /api/skill/v1/scales/:scaleId/evaluate` — 提交答案数组，获取评分

### Handoff 模式

1. `recommend_assessment` — 根据症状推荐量表
2. `generate_assessment_link` — 生成填写链接/二维码
3. `get_assessment_result` — 查询结果

### MCP 逐题工具（仅备选）

用途：

- 根据症状文本推荐适合的量表

适用时机：

- 用户说“最近总是很焦虑”
- 用户说“想测抑郁”
- 用户说“我最近睡不好”

建议：

- 先用它做推荐
- 再决定是否生成 handoff 链接

### 2. `generate_assessment_link`

用途：

- 生成 public handoff 链接与二维码

必填参数：

- `deviceId`
- `scaleId`

可选参数：

- `memberId`
- `language`
- `memberSnapshot`
- `callbackUrl`
- `callbackSecret`
- `callbackMetadata`

推荐说明：

- `deviceId` 对 OpenClaw 来说应固定为当前外部会话 ID
- 同一条量表链路中不要更换 `deviceId`

### 3. `get_assessment_result`

用途：

- 查询当前会话结果
- 判断用户是否已经完成 handoff

必填参数：

- `deviceId`
- `sessionId`

### 4. 逐题工具（仅备选）

- `create_assessment_session`
- `get_current_question`
- `submit_answer`
- `pause_assessment_session`
- `resume_assessment_session`
- `cancel_assessment_session`

说明：

- 这些工具保留
- 但对 OpenClaw 主链路不建议优先使用

---

## Handoff 返回结构说明

### `generate_assessment_link` 关键返回字段

- `session`
- `handoff.url`
- `handoff.qrCodeUrl`
- `completion.status`
- `completion.hasFinalResult`
- `completion.shouldPollResult`
- `completion.pollAfterSeconds`
- `nextAction`
- `callback`（如果配置了 callback）

### 关键判断逻辑

- `completion.status = pending`
  说明用户还没完成
- `completion.status = completed`
  说明最终结果已生成
- `completion.status = closed`
  说明会话已取消或过期

- `completion.hasFinalResult = true`
  说明可直接取结果并进入分析

- `completion.shouldPollResult = true`
  说明外部智能体应按轮询节奏继续查询

- `completion.pollAfterSeconds`
  建议下一次查询的最短等待秒数

---

## 推荐的 OpenClaw 编排逻辑

### Flow A：二维码/链接邀填

1. 从用户对话中判断是否要做量表
2. 如果需要，先调用 `recommend_assessment`
3. 选择量表后调用 `generate_assessment_link`
4. 把 `handoff.url` 或二维码发给用户
5. 提示用户填写完成后返回当前对话
6. OpenClaw 按 `completion.pollAfterSeconds` 轮询 `get_assessment_result`
7. 若 `status = pending`
   继续等待，不要误判为完成
8. 若 `hasFinalResult = true`
   将 `result` 作为事实源进入解释分析

### Flow B：用户说“我填完了”

如果你希望更像聊天体验，也可以：

1. 先发 handoff 链接
2. 用户回来后说“我填完了”
3. OpenClaw 再调一次 `get_assessment_result`
4. 如果还是 `pending`
   回复用户“系统还没收到提交结果，请稍后再试”
5. 如果是 `completed`
   进入结果分析

建议：

- 即使支持“我填完了”口令
- 底层仍然按 `completion` 状态判断
- 不要只凭用户一句“填完了”就假设结果存在

---

## callback / webhook 模式

### 何时使用

适合：

- 你想让项目在用户提交后主动把结果回推给外部系统
- 不想依赖持续轮询

### 注册参数

在 `generate_assessment_link` 或 `create_assessment_session` 中可传：

- `callbackUrl`
- `callbackSecret`
- `callbackMetadata`

### 回调时机

- 用户提交 public handoff 表单后
- 项目完成本地评分并落库后
- 项目尝试向 `callbackUrl` 发起 `POST`

### 回调 payload

```json
{
  "eventType": "assessment.completed",
  "sessionId": "session id",
  "deviceId": "external session id or null",
  "scaleId": "PHQ-9",
  "result": {
    "scaleId": "PHQ-9",
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

### 回调签名头

- `X-Ailiangbiao-Timestamp`
- `X-Ailiangbiao-Signature`

签名格式：

- `sha256=<hex digest>`

签名原文：

- `${timestamp}.${payloadText}`

其中：

- `timestamp = X-Ailiangbiao-Timestamp`
- `payloadText = 原始 JSON 字符串`

### 验签建议

OpenClaw 外围中转服务收到回调后应：

1. 读取原始 body
2. 读取时间戳头
3. 用 `callbackSecret` 做 HMAC-SHA256
4. 比较 `X-Ailiangbiao-Signature`
5. 再做时间窗口校验，防止重放

### 可靠性说明

当前实现：

- 提交后立即尝试回调
- 最多重试 3 次
- 超过上限会进入 dead-letter 状态
- callback 状态可通过 `get_assessment_result` 观察

所以建议：

- 轮询作为基线
- webhook 作为增强
- 不要只依赖 webhook 单点成功

---

## OpenClaw 结果分析规则

拿到最终结果后，OpenClaw / FastGPT 应：

- 只把结果当事实源使用
- 不要自己重新计算分数
- 不要重写量表结论

推荐输入给分析模型的字段：

- `scaleId`
- `scaleName`
- `totalScore`
- `conclusion`
- `details`
- 必要的成员摘要

推荐输出：

- 简短解释
- 风险点
- 2 到 5 条建议
- 是否建议继续做其他量表或联系医生

---

## 数据库与后续能力

这条 handoff 链路不会绕开主系统数据库。

用户提交后：

- 结果仍写回原 `AssessmentSession`
- 会生成正式 `AssessmentHistory`

因此后续仍可：

- 进入时间线
- 导出
- 科研使用
- 与项目内医生分身 / 主产品链路共用结果

---

## 外部智能体端最小实践建议

如果你只是想先跑通：

1. 用 MCP Key 调 `GET /api/skill/v1/scales` 拿到量表列表
2. 选一个量表，调 `GET /api/skill/v1/scales/:scaleId` 拿到题目
3. 在自己的对话中逐题收集用户回答
4. 把答案数组提交到 `POST /api/skill/v1/scales/:scaleId/evaluate`
5. 拿到结构化评分结果后做解释分析

进阶：

- 需要移动端扫码填写 → 用 Web Handoff 模式
- 需要提交后主动回推结果 → 配置 webhook callback
- 需要原生 MCP 集成 → 用 MCP 入口

这是当前最稳、最不容易出错的外部智能体集成方式。
