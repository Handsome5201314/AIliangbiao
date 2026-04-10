# `@ailiangbiao/assessment-skill`

本包不再被视为“运行时 skill 服务”。

它的定位是：

- 本地确定性量表评估核心的抽离目标
- MCP 工具与 HTTP 兼容契约的统一来源
- 写给外部智能体的 MCP 调用说明书

## Core Principles

- 量表原题是唯一评估依据
- 计分、题目推进、结果生成必须由本地代码完成
- 大模型只能做理解、追问、选项映射，不能直接算分
- 外部智能体必须通过会话式 MCP 工具逐题调用

## Canonical MCP Flow

推荐调用顺序：

1. `create_assessment_session`
2. `get_current_question`
3. `submit_answer`
4. 循环步骤 2-3，直到会话完成
5. `get_assessment_result`

辅助工具：

- `recommend_assessment`
- `recommend_scale`
- `get_scale_questions`
- `pause_assessment_session`
- `resume_assessment_session`
- `cancel_assessment_session`
- `add_growth_record`
- `get_growth_history`
- `evaluate_growth`

兼容遗留工具：

- `submit_and_evaluate`

## Rules For External Agents

- 每次只处理一题，不要一次性生成整张量表答案
- 如果用户答非所问，先追问，不要猜分
- 不要自行修改量表原题 wording
- 不要自行解释最终分数含义，除非服务端已经返回结果说明
- 如果会话中断，应继续使用原 `sessionId` 恢复，不要随意重建新会话

## Current Implementation Status

- 当前仓库内仍保留 Web/UI 兼容路由和旧整表接口
- MCP 是正式对外标准能力层
- HTTP session 路由仅作为现有应用兼容层
- 本包目前仍依赖宿主应用的 Prisma client 和本地量表 catalog
- Growth 已并入同一 Assessment Core，不再作为独立 Skill 产品概念对外宣传

## Stable Public Surface

- `@ailiangbiao/assessment-skill`
- `@ailiangbiao/assessment-skill/routes`
- `@ailiangbiao/assessment-skill/contracts`
- `@ailiangbiao/assessment-skill/server`
