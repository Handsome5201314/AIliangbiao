# 07 正式报告模板与医生复核

## 默认配置

- 默认医院：解放军总医院第一医学中心。
- 模板支持医院、科室、LOGO、医生签名、报告标题和页脚配置。
- 参考 SNAP-IV 和 ABC 纸质报告样式时，应使用 HTML/CSS 重建，不把照片作为报告背景。

## 第一版模板

1. SNAP-IV 正式报告模板。
2. ABC 正式报告模板。
3. 通用量表正式报告模板。

## 必填字段

- 报告编号。
- 医院名称。
- 科室。
- 儿童姓名或脱敏展示名。
- 性别。
- 出生日期或年龄。
- 量表名称。
- 评估日期。
- 原始分。
- 维度分/项目分。
- 结果说明。
- 审核医生姓名。
- 审核医生职称。
- 复核时间。

## 可缺失字段

- 门诊号。
- 住院号。
- 联系电话。
- 临床诊断。

缺失字段不能用默认值冒充真实数据。报告渲染时应显示为空或隐藏对应行。

## 报告状态

建议状态机：

```text
DRAFT
-> PENDING_DOCTOR_REVIEW
-> APPROVED
-> PARENT_VISIBLE
```

异常状态：

```text
REJECTED
SUPERSEDED
```

`PARENT_VISIBLE` 只能由 `APPROVED` 转入，不能由 AI、家长端或外部智能体直接设置。

## 医生复核规则

- 所有正式报告必须有关联 `DoctorReview`。
- 医生复核为必选流程。
- 医生可以查看 AI 辅助摘要，但复核结论由医生输入和确认。
- 复核过程应记录开始时间、完成时间、医生 ID、备注、结论和是否允许家长可见。
- 家长免登录 H5 链接不得查看正式报告。

## 当前仓库差距

当前 `lib/services/doctor-care.ts#getDoctorAssessmentReport` 会基于 `AssessmentHistory` 动态重算并返回可导出的报告数据，但没有独立 `AssessmentReport`、`ReportTemplate`、`DoctorReview` 或审批状态机。Phase 5 前不能把该动态导出视为正式报告 source of truth。

