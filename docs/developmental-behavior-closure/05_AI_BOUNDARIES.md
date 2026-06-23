# 05 AI 接入点、安全边界与黑盒规避

## AI 允许做的事

- 逐题对话采集。
- 题目解释和通俗化表达。
- 自然语言答案映射建议。
- 低置信度追问确认。
- 家长版解释。
- 医生复核摘要草稿。
- 健康教育内容匹配和解释。
- Skill/MCP 比赛演示编排。

## AI 禁止做的事

- 量表最终计分。
- 最终风险等级判定。
- 诊断结论。
- 药物或治疗处方。
- 正式报告审批。
- 绕过医生复核。
- 科研导出字段规则自由生成。
- 动态编造医学健康教育内容。

## 当前 AI 接入现状

| 接入点 | 当前作用 | Phase 0 风险 |
|---|---|---|
| `app/api/scales/analyze-conversation` | 规则 + 可选 LLM 从聊天记录提取答案建议。 | 需要把 confidence、evidence、追问确认和审计日志固化。 |
| `lib/services/assessment-advice.ts` | 基于确定性结果生成解释和建议。 | Prompt 已写明不重算分、不编造数据，后续需强制写 `AiInteraction`。 |
| `platform/v1/ai/explanations/question` | 题目解释和知识检索。 | 需要确保只使用已审核知识或题目定义作为来源。 |
| `doctor-bot` / realtime | 医生助手对话和建议评估卡片。 | 不能替代医生复核，不能生成正式报告审批。 |

## 审计日志要求

每次 AI 调用至少记录：

- `interactionType`
- `modelName`
- `promptHash`
- `inputSummary`
- `outputSummary`
- `confidence`
- `fallbackReason`
- `reviewRequired`
- `toolCalls`
- `assessmentSessionId`
- `questionId`
- `createdAt`

当前 `AiInteraction` 已有 `interactionType`、`promptHash`、`responseSummary`、`metadata` 等基础字段。Phase 1 可选择扩展该表，或新增 `AiDecisionLog`，但不能让 AI 行为只存在于日志文本或前端状态。

## 低置信度策略

- `confidence < 0.80`：必须追问确认。
- `confidence < 0.60`：不得自动保存映射结果，要求用户明确选择。
- 高风险/敏感项：即使置信度足够，也应保留医生复核标记。
- AI 映射只能给出建议，最终保存的是用户确认后的结构化答案。

## 黑盒规避

AI 输出必须可追溯到以下来源之一：

- 量表题目和选项。
- 题目临床意图和追问策略。
- 已审核 `QuestionExplanation` 或 `KnowledgeDoc`。
- 人工审核健康教育内容。
- 确定性计分结果。

不能出现“AI 根据综合判断得出风险等级”这类不可审计结论。

