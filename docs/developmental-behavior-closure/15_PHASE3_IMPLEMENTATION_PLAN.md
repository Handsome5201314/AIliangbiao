# Phase 3 医生端门诊评估与医生复核实施计划

## 目标

让审核通过的医生能在医生端创建或选择儿童档案，发起目标量表评估，拿到真实 H5 handoff 链接或医生现场填写会话，查看完成评估后的待复核队列，并完成 `DoctorReview`。

## 不做

- 不生成正式 PDF。
- 不创建正式 `AssessmentReport` 快照。
- 不让家长端查看未复核结果。
- 不绕过 `requireApprovedDoctorUser` 和患者写权限。
- 不大规模重构医生端页面。

## Source of Truth

- `AssessmentSession` / `AssessmentHistory`：确定性计分结果和原始答案。
- `DoctorReview`：Phase 3 的复核状态源，`PENDING` 表示待复核，`APPROVED` / `REJECTED` 表示医生已完成决策。
- `AssessmentReport`：保留给 Phase 5，不在本阶段提前写入。
- 家长端报告可见性：必须由已通过且允许家长可见的 `DoctorReview`，或未来已批准且 `parentVisible=true` 的 `AssessmentReport` 决定。

## 数据流

1. 医生在患者列表创建临时儿童档案，复用医生移动端临时档案能力并建立主责 `CareAssignment`。
2. 医生在患者详情页选择量表并发起评估：
   - `web_handoff` 量表生成 `/assessment/handoff/[token]`。
   - 其他医生可见量表创建医生现场/移动端会话，不伪造公开链接。
3. 量表完成后，所有 `physician_review` 结果创建或复用 `DoctorReview(PENDING)`：
   - `/api/assessment/save` 医生/家长提交。
   - Skill/Handoff 会话完成。
   - 门诊二维码提交。
4. 医生在 `/doctor/reviews` 或患者详情时间线查看待复核项。
5. 医生复核 API 更新 `DoctorReview`：
   - `APPROVED` 可选择 `allowParentVisible`。
   - `REJECTED` 必须填写备注。
6. 家长端历史报告接口只在复核通过且允许可见后返回结果，否则返回等待复核状态。

## 模块边界

- `lib/services/doctor-care.ts`：医生复核用例、待复核列表、患者详情投影、家长可见性判定。
- `app/api/doctor/reviews/**`：医生复核 API，只接受审核通过医生。
- `app/api/doctor/patients/**`：医生创建患者、发起评估。
- `app/api/assessment/history/[assessmentId]/report`：家长端报告可见性门禁。
- `app/doctor/**`：只增加入口和轻量表单，不重写医生端布局。

## 验证

- 新增 Phase 3 contract/behavior 测试：
  - 未审核医生不能复核。
  - 无患者权限医生不能复核。
  - 完成评估后进入待复核。
  - 复核通过后状态正确。
  - 拒绝需要备注。
  - 未复核报告家长不可见。
- 运行：
  - `rtk npm exec -- tsx --test tests/phase3-doctor-review.test.ts`
  - `rtk npx prisma validate`
  - `rtk npm test`
  - 视改动范围运行 `rtk npm run lint` 或记录既有 warning。
