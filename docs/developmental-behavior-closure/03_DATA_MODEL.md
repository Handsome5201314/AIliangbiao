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

## 建议扩展的已有模型

| 模型 | 建议扩展 |
|---|---|
| `AssessmentSession` | 增加 assessment purpose、baseline/followup 类型、doctor review 状态投影、低置信度答案标记。 |
| `AssessmentHistory` | 增加 review status 投影、report id、source channel、duration seconds、locked scoring snapshot。 |
| `ScaleScore` | 明确 `questionId` 类型、raw answer、mapped answer confidence、needsReview、AI evidence。 |
| `FollowUp` | 增加 taskType、dueDate、windowStartAt、windowEndAt、completedAssessmentId、lostToFollowupReason。 |
| `AiInteraction` | 增加 modelName、inputSummary、outputSummary、confidence、reviewRequired、toolCalls、errorCode。 |
| `McpLog` | 增加 toolName、requestId、argumentsSummary、resultSummary、success、errorCode、latencyMs。 |

## 建议新增模型

| 模型 | 目的 |
|---|---|
| `ScaleLicenseMetadata` | 记录每个量表的 `license_status`、使用范围、商业化开关、来源和版权说明。 |
| `DoctorReview` | 医生复核主实体，连接评估、医生、复核状态、结论、备注、耗时和家长可见性。 |
| `ReportTemplate` | 医院/科室抬头、LOGO、签名、模板版本和适用量表配置。 |
| `AssessmentReport` | 正式报告 source of truth，保存编号、模板、快照、状态、PDF URL 和审批时间。 |
| `EducationContent` | 人工审核健康教育内容库。 |
| `EducationDelivery` | 健康教育触达、查看、确认和随访关联日志。 |
| `FollowUpTask` | 1 个月/3 个月复测任务，若不复用 `FollowUp` 则独立建表。 |
| `ReminderLog` | 手工提醒记录，不接真实短信也要记录提醒行为。 |
| `ResearchImportBatch` | 历史 CSV 导入批次、字段映射、质量标记和导入人。 |
| `ResearchDerivedDataset` | 研究衍生表版本、字段快照和导出参数。 |
| `AiDecisionLog` | 若 `AiInteraction` 不扩展，单独记录 AI 答案映射、追问、摘要和安全审查。 |

## 核心字段建议

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
- `approvedAt`

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

## 3 个月窗口规则

基线后第 75-105 天内完成至少一种约定量表复测，记为：

```text
three_month_window_75_105_completed = true
```

该字段属于研究衍生字段，不应由 AI 自由生成，应由确定性查询或导出服务计算。

## 本阶段边界

Phase 0 不修改 `prisma/schema.prisma`。所有真实 schema 变更必须留到 Phase 1，并附 Prisma migration、测试和回滚说明。

