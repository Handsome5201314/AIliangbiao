# 03 数据模型设计与 Prisma 扩展

## 当前已有可复用模型

| 模型 | 可复用用途 |
|---|---|
| `User` | 患者、医生、访客和 agent session 绑定主体。 |
| `MemberProfile` | 儿童档案和家庭成员档案。 |
| `DoctorProfile` | 医生身份、医院、科室、职称、审核状态。 |
| `AssessmentSession` | 评估进行态，支持公开 token、Handoff、答案、完成状态。 |
| `AssessmentHistory` | 已完成评估历史，保存答案、总分、结论和结果详情。 |
| `AssessmentCallbackDelivery` | Handoff 完成后的 callback 投递状态。 |
| `DoctorScaleInvite` | 医生邀填 token 和关联量表。 |
| `ClinicScreeningPoint` / `ClinicScaleQr` / `ClinicScreeningSubmission` | 门诊二维码筛查和领取流程。 |
| `CareAssignment` / `MemberCareAccessGrant` / `CareTeam` | 医生-患者和团队授权。 |
| `ResearchConsent` | 科研知情同意。 |
| `ResearchExportLog` | 科研导出日志。 |
| `ChildBaseline` | 研究受试者基线脱敏信息。 |
| `ScaleScore` | 题级答案/分数/领域明细。 |
| `FollowUp` | 通用随访记录。 |
| `AiInteraction` | AI 交互审计基础表。 |
| `ReportView` | 报告查看日志。 |
| `Outcome3m` | 3 个月结局基础表。 |
| `InpatientRecord` | 住院/干预亚组记录。 |
| `McpLog` | MCP 调用基础日志。 |
| `KnowledgeDoc` / `QuestionExplanation` | 人工审核知识和题目解释素材。 |

## Phase 1 对已有模型的处理

Phase 1 不把医生复核、正式报告、健康教育、随访任务和 AI/MCP 审计继续塞进旧表字段里；旧模型只增加必要的 Prisma 反向关系，真实业务 source of truth 落到独立模型。

| 既有模型 | Phase 1 关系 |
|---|---|
| `AssessmentSession` / `AssessmentHistory` | 关联 `DoctorReview`、`AssessmentReport`、`EducationDelivery`、`FollowUpTask`、`AiDecisionLog`、`McpToolLog`。 |
| `MemberProfile` | 关联复核、报告、健康教育触达、复测任务、提醒日志和 AI 决策日志。 |
| `DoctorProfile` | 关联复核、审批报告、报告模板、健康教育内容、复测任务、提醒日志、研究导入批次和 AI 决策日志。 |
| `KnowledgeDoc` | 作为健康教育内容的人工审核来源。 |
| `ApiKey` | 关联 MCP 工具调用日志。 |

## Phase 1 已新增模型

| 模型 | 目的 |
|---|---|
| `ScaleLicenseMetadata` | 记录每个量表的 `license_status`、使用范围、商业化开关、来源和版权说明。 |
| `DoctorReview` | 医生复核主实体，连接评估、医生、复核状态、结论、备注、耗时和家长可见性。 |
| `ReportTemplate` | 医院/科室抬头、LOGO、签名、模板版本和适用量表配置。 |
| `AssessmentReport` | 正式报告 source of truth，保存编号、模板、快照、状态、PDF URL 和审批时间。 |
| `EducationContent` | 人工审核健康教育内容库。 |
| `EducationDelivery` | 健康教育触达、查看、确认和随访关联日志。 |
| `FollowUpTask` | 1 个月/3 个月复测任务 source of truth。 |
| `ReminderLog` | 手工提醒记录，不接真实短信也要记录提醒行为。 |
| `ResearchImportBatch` | 历史 CSV 导入批次、字段映射、质量标记和导入人。 |
| `AiDecisionLog` | 记录 AI 答案映射、追问、摘要、健康教育匹配和安全审查等可审计决策。 |
| `McpToolLog` | 记录 canonical MCP 工具调用名称、参数摘要、结果摘要、状态、耗时和入口。 |

## Phase 1 核心字段与边界

### `DoctorReview`

- `assessmentSessionId`
- `assessmentHistoryId`
- `memberProfileId`
- `doctorProfileId`
- `status`: `PENDING | IN_REVIEW | APPROVED | REJECTED | NEEDS_MORE_INFO | SUPERSEDED`
- `reviewConclusion`
- `reviewNotes`
- `allowParentVisible`
- `startedAt`
- `completedAt`
- `durationSeconds`

正式报告不能绕过该实体；医生复核是否允许家长可见由 `allowParentVisible` 控制，默认 `false`。

### `AssessmentReport`

- `reportNo`
- `assessmentSessionId`
- `assessmentHistoryId`
- `memberProfileId`
- `doctorReviewId`
- `templateId`
- `scaleId`
- `reportStatus`: `DRAFT | PENDING_DOCTOR_REVIEW | APPROVED | REJECTED | SUPERSEDED`
- `reportSnapshot`
- `parentVisible`
- `pdfUrl`
- `approvedByDoctorProfileId`
- `approvedAt`

报告状态只允许 `DRAFT | PENDING_DOCTOR_REVIEW | APPROVED | REJECTED | SUPERSEDED`，不存在 AI 或家长审批状态。报告必须引用 `doctorReviewId` 和 `templateId`。

### `ScaleLicenseMetadata`

- `scaleId`
- `scaleVersion`
- `licenseStatus`: `UNKNOWN | INTERNAL_REVIEW | AUTHORIZED_INTERNAL | AUTHORIZED_COMMERCIAL | RESTRICTED | EXPIRED`
- `usageScope`
- `commercialEnabled`
- `sourceName`
- `sourceUrl`
- `copyrightNotice`
- `licenseNotes`

`commercialEnabled` 默认 `false`，量表授权由 `scaleId + scaleVersion` 唯一确定。

### `ReportTemplate`

- `name`
- `templateVersion`
- `hospitalName`
- `departmentName`
- `logoUrl`
- `doctorSignatureConfig`
- `scaleIds`
- `status`
- `isDefault`
- `createdByDoctorProfileId`

### `EducationContent` / `EducationDelivery`

- `EducationContent.sourceDocId` 指向人工审核知识来源。
- `EducationContent.status` 复用 `KnowledgeReviewStatus`，默认 `DRAFT`。
- Phase 6 起，`EducationContent.reviewedByAdminId`、`reviewedAt`、`reviewComment` 和 `metadata` 记录健康教育内容自身的人工审核证据；仅 `APPROVED` 内容可进入匹配和触达。
- `EducationDelivery.deliveryStatus` 记录 `PENDING | DELIVERED | READ | CONFIRMED | CANCELLED`。
- `EducationDelivery` 只记录站内触达、阅读和确认状态，不接外部消息通道，也不替代医生复核结论。

### `FollowUpTask` / `ReminderLog`

- `FollowUpTask.taskType`: `ONE_MONTH | THREE_MONTH | CUSTOM`
- `dueDate`
- `windowStartAt`
- `windowEndAt`
- `completedAssessmentHistoryId`
- `completedAssessmentSessionId`
- `lostToFollowupReason`
- `ReminderLog.reminderChannel`: `MANUAL_PHONE | MANUAL_WECHAT | IN_PERSON | OTHER`

提醒日志只记录人工提醒，不接真实短信通道；`FAILED` 必须作为失败审计保存，不得把任务推进为 `REMINDED`。

### `ResearchImportBatch`

- `uploadedByDoctorProfileId`
- `requestedByUserId`
- `sourceName`
- `status`
- `fieldMapping`
- `qualitySummary`
- `importedRowCount`
- `errorSummary`

历史数据导入批次只保存字段映射和质量摘要，不在 schema 或迁移里写入真实儿童隐私样例。

### `AiDecisionLog` / `McpToolLog`

- `AiDecisionLog.decisionType`
- `modelName`
- `promptHash`
- `inputSummary`
- `outputSummary`
- `confidence`
- `reviewRequired`
- `McpToolLog.toolName`
- `requestId`
- `argumentsSummary`
- `resultSummary`
- `status`
- `latencyMs`

AI 决策日志只做审计，不产生诊断结论或评分 source of truth；`reviewRequired` 默认 `true`。MCP 日志记录工具调用事实，不把失败当成成功。

## 3 个月窗口规则

基线后第 75-105 天内完成至少一种约定量表复测，记为：

```text
three_month_window_75_105_completed = true
```

该字段属于研究衍生字段，不应由 AI 自由生成，应由确定性查询或导出服务计算。

## 落库与验证

- Prisma schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/20260623_developmental_closure_phase1/migration.sql`
- Contract test: `tests/developmental-closure-phase1-schema.test.ts`

## 本阶段边界

Phase 1 只做数据模型和迁移，不做 UI、不接真实短信、不做 AI 评分、不绕过医生复核、不写入真实儿童隐私样例。
