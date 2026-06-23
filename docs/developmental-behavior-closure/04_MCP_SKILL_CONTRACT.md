# 04 MCP/Skill 接口契约与确定性计分 API

## 职责边界

Skill 负责对话编排和用户体验：推荐量表、题目解释、逐题采集、自然语言答案映射建议、低置信度追问、家长版解释、医生摘要草稿、安全审查和比赛演示编排。

MCP/后端负责确定性事实：量表目录、题目 schema、会话创建、答案提交、确定性计分、风险规则、历史查询、趋势、医生复核状态、正式报告状态、随访任务和科研导出。

Skill 不得直接计算量表最终分数，LLM 不得最终判定风险等级。

## 当前已有接口

### 用户态 Skill Facade

`/api/skill/v1/*` 使用 agent session token，当前契约在 `packages/assessment-skill/src/contracts/http.ts` 和 `packages/assessment-skill/src/routes.ts`。

已存在核心路径：

- `GET /api/skill/v1/scales`
- `GET /api/skill/v1/scales/:scaleId`
- `POST /api/skill/v1/scales/:scaleId/evaluate`
- `POST /api/skill/v1/scales/:scaleId/sessions`
- `GET /api/skill/v1/scales/:scaleId/sessions/:sessionId`
- `POST /api/skill/v1/scales/:scaleId/sessions/:sessionId/answer`
- `GET /api/skill/v1/scales/:scaleId/sessions/:sessionId/result`
- `POST /api/skill/v1/scales/:scaleId/analyze-conversation`
- `GET /api/skill/v1/me/members`
- `GET /api/skill/v1/me/members/:memberId/context`

### 系统态 MCP

`/api/mcp` 使用 MCP API Key，支持 SSE/JSON-RPC；`/api/mcp/scale`、`/api/mcp/memory`、`/api/mcp/growth` 是兼容入口。

当前 scale MCP 工具包括：

- `recommend_assessment`
- `recommend_scale`
- `get_scale_questions`
- `create_assessment_session`
- `generate_assessment_link`
- `get_current_question`
- `submit_answer`
- `get_assessment_result`
- `pause_assessment_session`
- `resume_assessment_session`
- `cancel_assessment_session`
- `submit_and_evaluate`

## 目标接口补齐

后续 Phase 2 需要把材料包中的目标工具与当前工具对齐：

| 目标能力 | 当前对应 | 需补齐 |
|---|---|---|
| `list_supported_scales` | `GET /skill/v1/scales`、MCP `tools/list` | 增加 license/status 投影。 |
| `get_scale_schema` | `GET /skill/v1/scales/:scaleId`、`get_scale_questions` | 明确题目版本、语言、授权状态。 |
| `create_assessment_session` | 已有 | 加入 baseline/followup、doctorReviewRequired。 |
| `get_next_questions` | `get_current_question` | 支持批量/分页和低置信度追问上下文。 |
| `map_natural_language_answer` | `/analyze-conversation` | 输出 confidence、evidence、needsConfirmation，并写 AI 审计。 |
| `confirm_mapped_answer` | 暂缺 | 低置信度确认后才保存。 |
| `submit_answer` | 已有 | 记录答案来源、confidence、reviewRequired。 |
| `score_assessment` | `evaluateScaleAnswers`、`submit_and_evaluate` | 只允许确定性引擎。 |
| `create_doctor_review` | 暂缺 | Phase 3/5 必须新增。 |
| `approve_assessment_report` | 暂缺 | 只能医生调用，必须落审计。 |
| `export_research_dataset` | `/api/research/export` | 补齐字段字典和导出批次。 |

## 模式约束

生产模式：

```json
{
  "demo_mode": false,
  "doctor_review_required": true,
  "parent_visible_after_approval": true
}
```

比赛模式：

```json
{
  "demo_mode": true,
  "synthetic_data_only": true,
  "watermark": "DEMO_ONLY"
}
```

比赛模式不得复用真实儿童数据，不得影响生产模式权限。

