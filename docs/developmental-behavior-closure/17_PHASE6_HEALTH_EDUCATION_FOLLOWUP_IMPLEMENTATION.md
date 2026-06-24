# Phase 6 健康教育与随访闭环实施说明

## 目标与不做什么

目标是把医生复核后的健康教育和复测随访变成可审计链路：健康教育内容先人工审核，系统只匹配已审核内容；触达、阅读、确认、1 个月/3 个月复测任务和手工提醒都落库。

本阶段不做：

- 不让 AI 临时编造医学健康教育正文。
- 不接真实外部消息通道。
- 不把提醒失败当成功。
- 不绕过医生复核触发正式健康教育。

## Source of Truth

- `EducationContent.status = APPROVED` 是内容可匹配、可触达的唯一条件。
- `AssessmentReport.reportStatus = APPROVED` 且 `DoctorReview.status = APPROVED` 是正式健康教育触达前置条件。
- `EducationDelivery` 是触达、阅读、确认的审计记录。
- `FollowUpTask` 是 1 个月/3 个月复测任务 source of truth。
- `ReminderLog` 是手工提醒 source of truth，`FAILED` 保留失败事实，不推进任务状态。
- `AiDecisionLog(decisionType = EDUCATION_MATCH)` 记录“已审核内容匹配”决策，不记录或生成医学正文。

## 模块边界

- `lib/services/health-education.ts`
  - 创建医生健康教育草稿。
  - 提交健康教育内容审核。
  - 管理员审核通过后允许匹配。
  - 基于已批准正式报告创建站内触达记录。
  - 记录家长阅读和确认。
- `lib/services/follow-up-tasks.ts`
  - 生成 1 个月和 3 个月复测窗口。
  - 创建默认复测任务。
  - 记录手工提醒。
  - 保证失败提醒不改变任务为已提醒。
- `lib/services/admin-knowledge-reviews.ts`
  - 在现有知识审核队列中加入 `EDUCATION_CONTENT`。

## API 入口

- `GET/POST /api/doctor/education/contents`
- `POST /api/doctor/education/contents/:contentId/submit-review`
- `GET/POST /api/doctor/patients/:memberId/education`
- `POST /api/education/deliveries/:deliveryId/read`
- `GET/POST /api/doctor/patients/:memberId/follow-up-tasks`
- `POST /api/doctor/follow-up-tasks/:taskId/reminders`
- `GET/PATCH /api/admin/knowledge/reviews` 支持 `EDUCATION_CONTENT`

## 窗口规则

- 1 个月复测：到期日为基线后 1 个自然月，窗口为第 25-45 天。
- 3 个月复测：到期日为基线后 3 个自然月，窗口为第 75-105 天。

## 验证

- `tests/phase6-health-education-followup.test.ts`
  - 未审核内容不可推送。
  - AI 只能匹配已审核内容。
  - 触达/阅读落库。
  - 3 个月窗口任务生成正确。
  - 提醒记录可审计，失败不算成功。
- 已通过：
  - `npx prisma validate`
  - `npm test`
  - `npm run build`
