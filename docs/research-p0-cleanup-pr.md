# PR 草稿：科研 P0 数据与 H5 真实联调补齐

## Summary

本次变更按“彻底删除”口径清理成人/探索量表对外入口，并补齐科研 P0 数据模型、脱敏导出 API/脚本、H5 关键行为日志写入。

## 删除与收口

- 删除成人 manifest：`data/scales/phq-9.scale.json`、`data/scales/gad-7.scale.json`、`data/scales/sss.scale.json`
- 从 `lib/schemas/core/registry.ts` 移除 PSQI、RSES、MMSE、MoCA、MBTI、HOLLAND 注册
- 从 catalog、医生端、Skill Facade、admin governance 中移除 exploration selector 与 `doctorExplorationEnabled`
- 移除 H5 `mockData` 中的 `explorationScales`
- 本地 seed 与文档示例改为儿童量表

## 新增科研数据表

- `child_baseline`
- `scale_score`
- `followup`
- `ai_interaction`
- `report_view`
- `outcome_3m`
- `inpatient_record`

这些表通过现有 `MemberProfile`、`AssessmentSession`、`AssessmentHistory`、`DoctorProfile`、`User` 关系挂接，不重复创建评估会话概念。

## 导出字段与脱敏策略

- 新增 `GET /api/research/export?format=json|csv`
- 新增 `scripts/exportData.ts`
- 导出表：`child_baseline`、`assessment_session`、`assessment_history`、`scale_score`、`ai_interaction`、`followup`、`report_view`、`inpatient_record`、`outcome_3m`
- `researchSubjectId` 使用 HMAC-SHA256 从成员标识生成
- `rowKey` 使用 HMAC-SHA256 从行标识生成
- 直接标识字段黑名单：姓名、昵称、电话、邮箱、设备、原始 user/member/doctor/profile id、证件号、监护人签名等

## H5 接入

- AI 题目解释写入 `/api/research/ai-interactions`
- 报告查看写入 `/api/research/report-views`
- 自测提交完成写入 `/api/research/followups`
- H5 生产路径继续使用真实 API 与 AUS/Bearer Token

## 影响与回滚

- 成人/探索量表不再作为当前产品可用量表暴露
- 医生端、Skill API、admin catalog 测试均只围绕儿童临床主流程
- 回滚优先使用备份分支：`backup/pre-delete-20260620`
- 若只回滚科研导出，可回退 `app/api/research/**`、`lib/services/research-*`、`scripts/exportData.ts` 与 Prisma P0 迁移/schema 变更

## 已验证

- `rtk npm exec -- tsx --test tests/research-p0-contract.test.ts`
- `rtk npm exec -- tsx --test tests/scale-catalog.test.ts tests/ai-toy-device-binding.test.ts tests/admin-governance.test.ts`
- `rtk npm exec -- prisma validate`
- `rtk npm test`
- `rtk npm run build`
- `rtk npm --prefix mobile-h5-prototype run build`
- `rtk npm run smoke:local`

未完成项：

- `rtk npm run test:e2e:playwright` 已尝试，当前机器缺少 Playwright Chromium 可执行文件，需要先执行浏览器安装后重跑。
