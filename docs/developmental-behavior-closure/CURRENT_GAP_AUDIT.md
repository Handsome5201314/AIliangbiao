# 当前闭环架构缺口审计

审计日期：2026-06-27
最近更新：2026-06-28

本审计按 `系统架构.md` 的“一个统一底座，四类入口”目标，对当前仓库做本地只读验证和代码核对。结论是：项目已经不是空架构，医生复核、正式报告、健康教育、随访、科研导入导出、Skill/MCP、H5 都有可用骨架和 contract 测试；下一步应优先把真实端到端闭环、AI/MCP 审计和生产验收补齐，而不是重写系统。

## 本轮验证结果

已通过的阶段测试：

- `npx tsx --test tests/phase2-deterministic-scoring.test.ts`
- `npx tsx --test tests/phase3-doctor-review.test.ts`
- `npx tsx --test tests/mobile-h5-contract.test.ts`
- `npx tsx --test tests/phase5-report-template.test.ts`
- `npx tsx --test tests/phase6-health-education-followup.test.ts`
- `npx tsx --test tests/research-p0-contract.test.ts`
- `npx tsx --test tests/phase8-skill-mcp-demo.test.ts`

说明：这些测试覆盖了关键 contract、静态边界和部分服务函数，但不能替代完整浏览器端到端流程、真实数据库演练和生产发布前健康检查。

2026-06-28 本地补充验证：

- 当前本地旧开发库是非空旧库且尚未写入 Prisma baseline 标记，直接 `prisma migrate deploy` 会被 Prisma 以 P3005 拒绝；该检查未改动旧开发库 schema。
- 本地 `ai-scale-db-dev` 容器已按仓库 compose 重建为 `pgvector/pgvector:0.8.3-pg16`，保留既有 Docker volume。
- 在同一台本地 Postgres 中创建一次性空库后，`npx prisma migrate deploy` 可成功应用 `20260627_baseline`，说明空库 baseline 能创建当前 schema 和 `vector` 扩展。
- 在该隔离空库中调用 AI 答案映射审计服务，成功写入 1 条 `AiDecisionLog(ANSWER_MAPPING)`；检查确认摘要只包含 hash、长度、置信度和映射元数据，不包含原始回答文本；临时行和临时库已清理。

## 已具备的核心能力

### 统一评估与确定性计分

- `lib/scales/catalog.ts` 提供量表目录和 `evaluateScaleAnswers`。
- `app/api/assessment/save/route.ts` 已在服务端重算结果，不信任客户端传入的 `totalScore` 或 `conclusion`。
- `packages/assessment-skill/src/server/scale-service.ts` 的 Skill 会话完成路径会用确定性计分生成 `AssessmentHistory`，并在需要时创建 `DoctorReview(PENDING)`。
- 低置信度答案已通过 `confirmedLowConfidence` 约束，未确认的低置信度答案不能直接提交。

### 医生复核与正式报告

- `DoctorReview`、`AssessmentReport`、`ReportTemplate` 已在 Prisma schema 中存在。
- `lib/services/doctor-care.ts` 已包含创建待复核、完成复核、生成已批准正式报告、家长报告可见性判断、医生报告读取等核心用例。
- 家长报告接口已检查复核状态，未复核结果返回等待医生复核状态。
- 报告模板已有 SNAP-IV、ABC 和通用模板基础。

### 家长 H5 / Handoff

- 根首页手机端已接入迁移后的 H5。
- H5 服务层不再依赖 `mockData`、`session-mock` 或 Vite 独立环境变量。
- 公开 handoff 链接支持保存草稿，且不会暴露正式报告 payload。
- H5 报告读取会识别 `PENDING_DOCTOR_REVIEW` 并显示等待医生复核。
- H5 AI 题目解释走后端已审核题解/知识接口，并记录 `AiInteraction`。

### 健康教育与随访

- `EducationContent`、`EducationDelivery`、`FollowUpTask`、`ReminderLog` 已在 schema 中存在。
- 健康教育匹配只选择 `APPROVED` 的人工审核内容。
- 正式健康教育触达要求 `AssessmentReport(APPROVED)` 和 `DoctorReview(APPROVED)`。
- 随访任务支持 1 个月/3 个月窗口，提醒记录为手工提醒，不接外部短信通道。
- 提醒失败不会被当作成功推进任务状态。

### 科研导入导出

- `ResearchImportBatch`、`ResearchImportRow`、`ResearchFieldMapping`、`ResearchDerivedDataset` 已存在。
- 导出字段字典包含报告查看、健康教育、医生复核、1 个月/3 个月复测和 75-105 天窗口。
- 导出使用 HMAC 研究编号，不使用原始成员 ID 片段。
- 历史导入会标记缺失值，不把缺失分数强制当作 0。

### Skill/MCP

- `packages/assessment-skill` 已明确区分用户态 Skill Facade 和系统态 MCP。
- canonical scale tools 覆盖量表目录、schema、自然语言映射、确认、创建会话、提交答案、确定性计分和结果查询。
- Phase 8 demo 使用合成 `DEMO_ONLY` 数据，不放宽生产 MCP API Key 或 agent session token 权限。
- 本轮已将 MCP 工具调用审计从旧 `McpLog` 收口到 `McpToolLog`，并记录工具名、入口、状态、成功标记、脱敏参数摘要和结果摘要。
- Skill 自然语言答案映射和低置信度确认已写入 `AiDecisionLog(ANSWER_MAPPING / LOW_CONFIDENCE_CONFIRMATION)`，只记录 hash、长度、置信度、方法和会话摘要，不落原始回答文本。
- Skill 批量会话分析 `/api/skill/v1/scales/:scaleId/analyze-conversation` 已写入 `AiDecisionLog(ANSWER_MAPPING)`，审计发生在已鉴权代理层，不让公开分析接口信任客户端身份字段。
- H5 当前题已接入真实 Skill 答案映射接口，低置信度答案必须调用确认接口后才会写入 `answerDetails.confirmedLowConfidence`。

## 需要优先补齐的缺口

### P0：端到端闭环验收缺口

当前阶段测试说明关键 contract 存在，但仍缺一条真实端到端验收脚本或 Playwright 流程：

```text
医生登录 -> 创建/选择儿童 -> 发起量表 -> H5 链接填写 -> 提交后进入待复核 -> 医生复核通过 -> 生成正式报告 -> 家长可见 -> 触达健康教育 -> 创建随访任务 -> 科研导出包含该链路数据
```

下一批实现应新增一个本地 smoke/Playwright 验收入口，至少跑通演示数据，不依赖生产数据库。

### P0：AI 答案映射审计与 H5 当前题确认已完成第一轮，仍需 HTTP 级演练

当前状态：

- 题目解释会写 `AiInteraction`。
- 健康教育匹配会写 `AiDecisionLog(EDUCATION_MATCH)`。
- Skill 自然语言答案映射会写 `AiDecisionLog(ANSWER_MAPPING)`。
- Skill 低置信度确认会写 `AiDecisionLog(LOW_CONFIDENCE_CONFIRMATION)`。
- Skill 批量会话分析会写 `AiDecisionLog(ANSWER_MAPPING)`，并记录 `messagesHash`、消息数量、覆盖率、是否使用 LLM、候选数量和低置信度数量。
- H5 `AssessmentRunner` 当前题可输入自然语言观察，调用 `/api/skill/v1/scales/:scaleId/map-answer` 获取候选答案；低置信度候选必须调用 `/mapped-answers/confirm` 后才保存。
- H5 提交会把 `source`、`confidence`、`evidence`、`confirmedLowConfidence` 转成 `answerDetails`，普通保存路径会拒绝未确认的低置信度答案。
- 审计摘要只记录 `textHash` / `evidenceHash` / `messagesHash`、长度、置信度、映射方法、是否需要确认、agent session 摘要，不保存原始回答、对话内容、证据原文或密钥。

后续仍需补：

- 用真实 Skill token HTTP 请求跑一次本地数据库演练，确认完整鉴权入口也会写入 `ai_decision_log` 且不含原始文本。
- 用手机宽度浏览器跑一次 H5 当前题映射、低置信度确认、提交等待复核的 smoke。
- 如要记录真实数据库 `AssessmentSession.id`，必须来自业务会话参数，不能把 agent token 的 `session_id` 当作外键。
- AI 仍只能生成候选答案，不参与最终分数和风险等级。

### P0：MCP 调用审计已完成第一轮收口，仍需端到端演练

本轮已完成：

- `lib/mcp/auth.ts` 的 `logMcpToolCall` 写入 `McpToolLog`。
- canonical MCP 入口和 `scale` / `memory` / `growth` 兼容入口都会记录成功和失败工具调用。
- 参数摘要只记录 key 列表和安全 ID，不记录完整 `answers`、用户文本或 token。

后续仍需补：

- 用真实 MCP 请求做本地数据库演练，确认 `mcp_tool_log` 行落库。
- 将 dashboard / admin MCP 审计页从旧 `McpLog` 迁到 `McpToolLog`。
- 如需要兼容历史统计，再单独提供旧 `McpLog` 的只读迁移策略。

### P1：H5 AI 助手仍需浏览器验收和更顺滑追问体验

当前 H5 AI 题目解释已经接后端，当前题自然语言答案映射也已接入真实 Skill 接口；仍需在手机宽度浏览器里验证完整交互，并把“追问确认”体验从按钮确认升级成更自然的问答式确认。

下一批实现：

- 当前题映射在真实浏览器里跑通高置信度应用、低置信度确认、手动选择覆盖。
- 确认后的 `answerDetails.source = user_confirmed_mapping` 和 `confirmedLowConfidence = true` 在后端 `resultDetails` 可查。
- 模型 key 走超级管理员后台 `ApiKey(serviceType=text)`，不使用前端假 token。

### P1：医生端闭环需要浏览器验收

医生端页面和 API 已具备主流程，但仍需验证真实浏览器交互：

- 创建儿童档案。
- 发起量表。
- 复制或打开 H5 链接。
- 查看待复核队列。
- 复核通过后读取正式报告。
- 推送健康教育并创建随访任务。

下一批实现应补 Playwright 或本地 smoke 脚本，避免只靠源码静态断言。

### P1：科研导出需要真实链路样本演练

科研导出服务已有字段和脱敏边界，但仍需用本地种子数据验证：

- 系统干预组从真实评估、报告、教育、随访数据生成衍生表。
- 历史导入批次能保留字段映射、质量标记和缺失值。
- 75-105 天窗口在真实日期样本上可复现。

### P2：Skill/MCP 外部能力还缺医生复核、报告、随访、科研的 canonical 工具

当前 canonical scale tools 主要覆盖量表和会话。按目标架构，后续可扩展但不应一次性铺太大：

- `get_doctor_review_status`
- `get_assessment_report_status`
- `list_follow_up_tasks`
- `get_research_export_schema`

这些工具只能读状态或返回安全摘要，不能绕过医生复核、不能导出直接身份字段。

## 推荐下一批实现顺序

1. 补 AI/MCP 审计本地数据库落库演练。
2. 补 H5 当前题答案映射的手机宽度浏览器 smoke。
3. 补一条医生端到 H5 到报告的本地端到端 smoke。
4. 补 MCP `mcp_tool_log` 本地数据库落库演练和 admin 审计页迁移。
5. 补科研导出真实链路样本验证。

## 发布与生产边界

- 本轮审计不触碰生产服务器和生产数据库。
- 后续涉及 Prisma schema 或生产数据写入时，必须先给出迁移 SQL、本地演练、备份路径和回滚方案，并等待确认。
- 不改 Nginx、域名、HTTPS、Docker volume。
- 生产发布只能来自 Git 已确认版本。
