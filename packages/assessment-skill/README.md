# `@ailiangbiao/assessment-skill`

本包不再被视为“运行时 skill 服务”。

它的定位是：

- 本地确定性量表评估核心的抽离目标
- MCP 工具与 HTTP 兼容契约的统一来源
- 写给外部智能体的 MCP 调用说明书

## Core Principles

- 量表原题是唯一评估依据
- 计分、题目推进、结果生成必须由本地代码完成
- 大模型只能做理解、追问、选项映射，不能直接算分
- 外部智能体可通过 REST API 或 MCP 工具接入

## 推荐接入方式

### REST API（最简单，主推）

外部智能体只需两步 HTTP 调用：

```
GET  /api/skill/v1/scales/:scaleId          → 获取量表定义（题目、选项）
POST /api/skill/v1/scales/:scaleId/evaluate  → 提交答案，获取确定性评分
```

认证：`Authorization: Bearer <MCP_API_KEY>`

适用场景：OpenClaw、FastGPT、Coze、Dify 等任何能发 HTTP 请求的平台。外部 agent 在自己的对话中收集用户回答，最后一次性提交评分。

### Web Handoff（适合移动端扫码）

1. 调用 `generate_assessment_link` 生成填写链接/二维码
2. 用户在浏览器中完成标准问卷
3. 轮询 `get_assessment_result` 获取结果

详见：`docs/openclaw-mcp-handoff-guide.md`

### MCP 工具（可选，适合原生 MCP runtime）

逐题调用模式，适合原生支持 MCP 的 agent runtime：

1. `create_assessment_session`
2. `get_current_question`
3. `submit_answer`
4. 循环步骤 2-3，直到会话完成
5. `get_assessment_result`

辅助工具：

- `recommend_assessment`
- `recommend_scale`
- `get_scale_questions`
- `pause_assessment_session`
- `resume_assessment_session`
- `cancel_assessment_session`
- `add_growth_record`
- `get_growth_history`
- `evaluate_growth`

兼容遗留工具：

- `submit_and_evaluate`

## Rules For External Agents

- 每次只处理一题，不要一次性生成整张量表答案
- 如果用户答非所问，先追问，不要猜分
- 不要自行修改量表原题 wording
- 不要自行解释最终分数含义，除非服务端已经返回结果说明
- 如果会话中断，应继续使用原 `sessionId` 恢复，不要随意重建新会话

## Current Implementation Status

- REST API（Skill facade）是主推外部接入方式
- MCP 保留为可选接入方式，适合原生 MCP runtime
- Web Handoff 是移动端推荐模式
- 当前仓库内仍保留 Web/UI 兼容路由和旧整表接口
- 本包目前仍依赖宿主应用的 Prisma client 和本地量表 catalog
- Growth 已并入同一 Assessment Core，不再作为独立 Skill 产品概念对外宣传

## Stable Public Surface

- `@ailiangbiao/assessment-skill`
- `@ailiangbiao/assessment-skill/routes`
- `@ailiangbiao/assessment-skill/contracts`
- `@ailiangbiao/assessment-skill/server`

## Web Handoff Flow

For scales configured with `interactionMode = web_handoff`:

1. Call `generate_assessment_link` or `create_assessment_session`
2. Read `session.handoff.url`
3. Let the user complete the public handoff form
4. After the user says the form is done, call `get_assessment_result`

Notes:

- `web_handoff` keeps `AssessmentSession` as the single source of truth
- the public form submits back into the same session and produces exactly one `AssessmentHistory`
- `get_current_question` is not the primary path for `web_handoff` scales

## Handoff Completion Contract

When using `generate_assessment_link`, external agents should treat the returned `completion` object as the source of truth:

- `completion.status = pending | completed | closed`
- `completion.hasFinalResult`
- `completion.shouldPollResult`
- `completion.pollAfterSeconds`

Recommended orchestration:

1. Generate the public link
2. Send `handoff.url` or `handoff.qrCodeUrl` to the user
3. Poll `get_assessment_result` only when `completion.shouldPollResult = true`
4. Continue to poll until `completion.hasFinalResult = true`
5. If `completion.status = closed`, stop polling and treat the session as cancelled or expired

## Optional Webhook Callback

`generate_assessment_link` and `create_assessment_session` now accept optional callback parameters:

- `callbackUrl`
- `callbackSecret`
- `callbackMetadata`

If configured, the project will attempt to POST the final structured result after the public handoff form is submitted.

Callback payload shape:

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

Security headers:

- `X-Ailiangbiao-Timestamp`
- `X-Ailiangbiao-Signature` (`sha256=...`) when `callbackSecret` is provided

Delivery behavior:

- immediate callback attempt after form submission
- retry up to 3 times before marking the callback as dead-letter
- callback delivery status can be surfaced through `get_assessment_result`
