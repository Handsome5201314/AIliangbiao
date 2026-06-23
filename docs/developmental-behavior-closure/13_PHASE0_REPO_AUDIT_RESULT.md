# 13 Phase 0 仓库审计结果

## 1. 当前仓库总体架构总结

仓库是 Next.js App Router 单体应用，使用 TypeScript、Prisma、PostgreSQL、Zod 和 React。页面层在 `app/`，API 层在 `app/api/`，量表定义在 `lib/schemas/**`，量表目录和确定性评分统一在 `lib/scales/catalog.ts`，外部接入契约在 `packages/assessment-skill/`，MCP 在 `app/api/mcp` 与 `lib/mcp/**`。

当前架构适合继续演进为儿童发育行为健康促进闭环系统，不需要重写。

## 2. 当前仓库已具备的能力

- 儿童临床量表目录和确定性计分。
- `AssessmentSession` 进行态和 `AssessmentHistory` 完成态。
- Skill Facade、agent session token 和 MCP API Key 两套外部接入。
- Web Handoff 公开填写链路。
- 医生注册/登录/审核、医生工作台、患者列表、邀填、门诊筛查。
- 管理后台、MCP Key、知识审核、审计日志、组织和策略管理。
- 科研 P0 数据表、事件记录和脱敏导出服务。
- `QuestionExplanation`、`KnowledgeDoc` 和知识审核基础。

## 3. 当前仓库需要扩展的能力

- 独立医生复核状态机。
- 正式报告实体、模板和审批。
- 家长正式报告查看权限。
- 1 个月/3 个月随访任务和手工提醒。
- 人工审核健康教育内容库和触达记录。
- 历史数据导入、字段映射和研究衍生表。
- 量表授权状态持久化。
- AI/MCP 调用审计字段。

## 4. 当前仓库需要新增的能力

建议新增模型：`ScaleLicenseMetadata`、`DoctorReview`、`ReportTemplate`、`AssessmentReport`、`EducationContent`、`EducationDelivery`、`FollowUpTask` 或强化 `FollowUp`、`ReminderLog`、`ResearchImportBatch`、`ResearchDerivedDataset`、`AiDecisionLog` 或强化 `AiInteraction`。

## 5. 与目标系统冲突或需谨慎处理的部分

- 旧 `/api/assessment/save` 直接接收 `totalScore/conclusion` 写库，和“所有计分必须服务端确定性完成”的目标存在冲突。
- `app/api/scales/analyze-conversation` 会在 LLM 失败时回退到规则建议；后续应要求低置信度可见、追问确认和 AI 审计。
- 当前有 SMS 相关 API 和 Tencent SMS service，本闭环初期不应依赖真实短信。
- 当前报告是动态导出数据，不是审批后的正式报告。
- `VINELAND_3` 只做原始分汇总，标准分/常模/授权状态未完成。

## 6. 现有 Prisma schema 可复用模型清单

`User`、`MemberProfile`、`DoctorProfile`、`AssessmentSession`、`AssessmentHistory`、`AssessmentCallbackDelivery`、`DoctorScaleInvite`、`ClinicScreeningPoint`、`ClinicScaleQr`、`ClinicScreeningSubmission`、`CareAssignment`、`CareTeam`、`MemberCareAccessGrant`、`ResearchConsent`、`ResearchExportLog`、`ChildBaseline`、`ScaleScore`、`FollowUp`、`AiInteraction`、`ReportView`、`Outcome3m`、`InpatientRecord`、`McpLog`、`KnowledgeDoc`、`QuestionExplanation`。

## 7. 建议新增或扩展的 Prisma 模型清单

新增优先级：

1. `ScaleLicenseMetadata`
2. `DoctorReview`
3. `ReportTemplate`
4. `AssessmentReport`
5. `EducationContent`
6. `EducationDelivery`
7. `ReminderLog`
8. `ResearchImportBatch`
9. `ResearchDerivedDataset`

扩展优先级：

1. `AssessmentSession`
2. `AssessmentHistory`
3. `FollowUp`
4. `AiInteraction`
5. `McpLog`
6. `ScaleScore`

## 8. 现有量表注册体系审计

`lib/schemas/core/registry.ts` 注册内置量表，`lib/scales/catalog.ts` 合并内置量表和 `data/scales/*.scale.json` manifest，提供 `publicClinicalChild`、`doctorVisible`、`adminAll`、`voiceFriendlyChild` selector。`evaluateScaleAnswers(scaleId, answers)` 是当前确定性评分入口。

目录规则清晰，可作为后续 source of truth。授权状态尚未持久化。

## 9. 七个目标量表当前实现状态

| 量表 | 当前 ID | 题目数 | 交互模式 | 结果模式 | 状态 |
|---|---:|---:|---|---|---|
| ABC | `ABC` | 57 | `voice_guided` | `physician_review` | 已注册，确定性计分。 |
| ATEC | `ATEC` | 77 | `voice_guided` | `physician_review` | 已注册，确定性计分。 |
| CARS | `CARS` | 15 | 未显式设置，目录默认可见 | `physician_review` | 已注册，需医生复核语境。 |
| M-CHAT-R | `M_CHAT_R` | 20 | `voice_guided` | `physician_review` | 已注册，AI toy 语音白名单。 |
| SRS | `SRS` | 65 | 未显式设置，目录默认可见 | `physician_review` | 已注册，需医生复核语境。 |
| SNAP-IV | `SNAP-IV` | 26 | `voice_guided` | `physician_review` | 已注册，AI toy 语音白名单。 |
| VINELAND-3 | `VINELAND_3` | 502 | `web_handoff` | `physician_review` | 已注册，原始分汇总，未启用标准分。 |

当前 `publicClinicalChild` 还包含 `CBCL_113` 和 `TAS_37`，但本闭环第一批开发只聚焦上述七个目标量表。

## 10. Skill/MCP 接口现状

Skill Facade 已有量表目录、详情、评估、会话、答题、结果、自然语言分析、成员上下文等 REST 接口。MCP 已有 canonical SSE/JSON-RPC 和 scale/growth/memory 兼容入口，scale 工具覆盖推荐、获取题目、创建会话、生成 handoff、提交答案、获取结果、暂停/恢复/取消和提交后计分。

缺口是医生复核、正式报告审批、随访任务、科研导出和 license 状态尚未纳入统一工具契约。

## 11. AI 接入点现状

主要接入点包括聊天记录分析、评估建议生成、题目解释、doctor bot 和 realtime agent。现有 prompt 已有“不重算分、不编造数据”的意识，但 AI 审计、低置信度确认、健康教育人工审核来源和医生复核摘要留痕仍需产品化。

## 12. 医生端、家长 H5、科研端现状

- 医生端：已有工作台、患者、邀填、门诊筛查、协作团队、科研页。缺待复核队列和正式报告审批。
- 家长 H5：已有 `/assessment/handoff/[token]` 和 mobile prototype，能对 `physician_review` 显示等待医生复核。缺居家复测任务、报告二次校验和完整趋势。
- 科研端：已有 P0 导出和脱敏基础。缺历史导入、字段映射、质量标记和衍生表版本。

## 13. 与目标闭环系统的差距分析

最大差距不是量表题库，而是“复核-报告-教育-随访-科研”的闭环业务对象尚未成为数据库里的强 source of truth。当前系统能完成评估和外部接入，但正式医学报告、医生复核、健康教育和随访仍多是页面/服务层能力或待补模型。

## 14. Phase 1 开发前必须确认的问题

1. `DoctorReview` 和 `AssessmentReport` 是否所有 `physician_review` 量表强制创建，还是仅七个目标量表强制创建？
2. `FollowUp` 是直接扩展为任务模型，还是新增 `FollowUpTask` 并保留 `FollowUp` 为事件日志？
3. `ScaleLicenseMetadata.licenseStatus` 的枚举值是否采用本目录建议值？
4. 家长正式报告二次校验采用登录、一次性 token，还是两者都支持？
5. 健康教育内容库先复用 `KnowledgeDoc`，还是新增独立 `EducationContent`？

## 15. Phase 1 推荐任务列表

1. 新增 Prisma enums 和模型：授权、医生复核、报告模板、正式报告。
2. 扩展 `AssessmentHistory`/`AssessmentSession` 的复核和报告投影字段。
3. 为 `AiInteraction`/`McpLog` 补齐审计字段或新增日志模型。
4. 新增 migration 和 schema contract tests。
5. 添加最小服务层接口，但不急着做 UI 大改。
6. 更新本目录数据模型和验收文档。

