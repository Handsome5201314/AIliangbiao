# 01 现有仓库审计与差距分析

## 当前仓库总体判断

当前仓库已经从单一量表页面演进为综合评估平台，技术底座为 Next.js App Router + TypeScript + Prisma + PostgreSQL，评估核心由本地确定性量表代码完成，外部接入通过 `/api/skill/v1/*`、`/api/mcp`、Web Handoff 和 agent session 提供。

这与闭环系统目标方向一致，Phase 1 之后应沿现有模块继续扩展，不应重写技术栈或另起后端。

## 已具备能力

| 能力 | 当前事实 |
|---|---|
| 技术栈 | `package.json` 使用 Next.js、React、Prisma、PostgreSQL、Zod、TypeScript、Tailwind/Radix UI。 |
| 评估会话 | `AssessmentSession` 支持状态、公开 token、答案、结果、回写 `AssessmentHistory`。 |
| 评估历史 | `AssessmentHistory` 保存量表、版本、答案、总分、结论、结果详情。 |
| 七个目标量表 | `ABC`、`ATEC`、`CARS`、`M_CHAT_R`、`SRS`、`SNAP-IV`、`VINELAND_3` 已注册。 |
| 确定性计分 | 每个目标量表有 `calculateScore`，目录统一通过 `evaluateScaleAnswers` 调用。 |
| Skill Facade | `/api/skill/v1/*` 使用 agent session token，支持量表目录、会话、答题、结果、成员上下文。 |
| MCP | `/api/mcp` canonical SSE/JSON-RPC 和 `/api/mcp/scale` 兼容入口均存在，使用 MCP API Key。 |
| 家长填写 | `/assessment/handoff/[token]` 支持公开 handoff；`physician_review` 模式提交后提示等待医生复核。 |
| 医生端 | `app/doctor` 已有工作台、患者、邀填、门诊筛查、科研页、协作团队等入口。 |
| 管理端 | `app/admin` 已有医生审核、MCP Key、知识审核、审计、组织、策略等治理入口。 |
| 科研 P0 | 已有 `ChildBaseline`、`ScaleScore`、`FollowUp`、`AiInteraction`、`ReportView`、`Outcome3m`、`InpatientRecord` 和脱敏导出服务。 |

## 需要强化

| 能力 | 当前基础 | Phase 1+ 需要强化 |
|---|---|---|
| 医生复核 | 量表有 `resultDeliveryMode = physician_review`，医生端可查看/导出报告样数据。 | 新增独立 `DoctorReview` 状态机，记录复核医生、结论、耗时和可见性。 |
| 正式报告 | 当前 `getDoctorAssessmentReport` 动态重算并返回导出数据。 | 新增 `AssessmentReport`、`ReportTemplate`，报告需落库、编号、审批、PDF/打印。 |
| 家长可见性 | Handoff/Invite 对 `physician_review` 不直接展示结果。 | 家长正式报告查看必须绑定登录或二次校验，并检查医生复核状态。 |
| 确定性入口 | 主 Skill/会话路径服务端计分。 | 收敛旧 `/api/assessment/save`，禁止前端传入 `totalScore/conclusion` 作为最终事实。 |
| AI 审计 | `AiInteraction` 和 `/api/research/ai-interactions` 已存在。 | AI 逐题解释、答案映射、追问、医生摘要都要统一写审计日志。 |
| 健康教育 | 有知识库/知识审核/QuestionExplanation。 | 新增人工审核健康教育内容库和触达日志，禁止 AI 临时编造医学内容。 |
| 随访 | `FollowUp` 是通用记录。 | 明确 1 个月/3 个月任务、提醒记录、75-105 天窗口判断。 |
| 科研导入 | 有脱敏导出和 P0 数据表。 | 新增历史导入批次、字段映射、质量标记和衍生表导出规则。 |
| 授权状态 | 量表目录没有持久化 `license_status`。 | 新增或扩展授权元数据，商业化前必须核验。 |

## 需要谨慎处理

- 旧 `/api/assessment/save` 接收 `totalScore` 和 `conclusion` 后写入 `AssessmentHistory`，Phase 1/2 应改为服务端根据 `scaleId + answers` 计算。
- `app/api/scales/analyze-conversation` 可使用 LLM 生成答案建议，虽然会校验为合法选项，但低置信度确认和审计日志仍需补齐。
- 现有 SMS 相关 API/服务存在，本闭环初期不应把真实短信作为必需依赖。
- `VINELAND_3` 当前是原始分汇总和医生复核链路，未启用标准分、常模换算和商业授权结论。
- 当前仓库未见 `.trellis`，本轮按允许范围只落库 Phase 0 文档；如后续多 Agent 长期协作，建议单独初始化 Trellis 并把本目录作为 spec 来源之一。

