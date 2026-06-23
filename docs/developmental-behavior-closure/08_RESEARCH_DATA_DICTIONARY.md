# 08 科研数据字典与导出规范

## 脱敏边界

科研导出默认不得导出：

- 姓名。
- 电话。
- 身份证号。
- 门诊号。
- 住院号。
- 设备原始标识。
- 任何可直接识别儿童或家长身份的字段。

当前 `lib/services/research-export.ts` 已有 `DIRECT_IDENTIFIER_FIELDS` 和 HMAC 派生研究编号基础，Phase 7 应在此基础上补齐字段字典、导入批次和衍生表版本。

## 核心字段

| 字段 | 说明 |
|---|---|
| `research_subject_id` | 脱敏研究编号。 |
| `group_type` | 历史对照组或系统干预组。 |
| `baseline_date` | 基线日期。 |
| `age_months` | 月龄。 |
| `sex` | 性别。 |
| `clinical_phenotype` | 临床表型。 |
| `diagnosis_label` | 医生或历史资料记录的诊断标签，不能由 AI 生成。 |
| `scale_id` | 量表 ID。 |
| `scale_version` | 量表版本。 |
| `baseline_score` | 基线总分。 |
| `baseline_risk_level` | 确定性规则或医生复核后的风险层级。 |
| `dimension_scores` | 维度分 JSON。 |
| `report_viewed` | 报告是否查看。 |
| `education_pushed` | 健康教育是否推送。 |
| `education_read` | 健康教育是否阅读。 |
| `doctor_review_completed` | 医生复核是否完成。 |
| `doctor_assessment_duration_seconds` | 医生评估/复核耗时。 |
| `one_month_reassessment_completed` | 1 个月复测是否完成。 |
| `three_month_reassessment_completed` | 3 个月复测是否完成。 |
| `three_month_window_75_105_completed` | 基线后 75-105 天窗口内是否完成约定复测。 |
| `lost_to_followup_reason` | 失访原因。 |
| `hospitalized` | 是否住院。 |
| `intervention_subgroup` | 干预亚组。 |
| `pre_score` | 干预前分数。 |
| `post_score` | 干预后分数。 |
| `data_quality_flags` | 缺失、异常、来源不一致等质量标记。 |

## 主结局

3 个月随访复测完成率：

```text
基线后 75-105 天内完成至少一种约定量表复测的人数 / 应完成 3 个月复测人数
```

## 次要结局

- 量表数据完整率。
- 报告查看率。
- 健康教育阅读率。
- 医生复核完成率。
- 医生评估耗时。
- 1 个月复测完成率。
- 住院综合干预亚组前后变化。

## 导出表建议

当前导出基础包括 `child_baseline`、`assessment_session`、`assessment_history`、`scale_score`、`ai_interaction`、`followup`、`report_view`、`inpatient_record`、`outcome_3m`。Phase 7 建议新增：

- `research_import_batch`
- `research_import_row`
- `research_field_mapping`
- `research_derived_dataset`

