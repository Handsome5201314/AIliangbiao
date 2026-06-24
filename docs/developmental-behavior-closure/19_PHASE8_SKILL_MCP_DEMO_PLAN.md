# Phase 8 Skill + MCP 比赛演示包实施计划

## 目标与不做事项

目标：提供一个可复现的 Skill + MCP 比赛演示包，用 5 个合成案例展示量表目录、schema、自然语言答案映射、会话/提交/结果的调用顺序、Web Handoff 边界、确定性计分、医生复核边界和安全解释。

不做：

- 不接入真实儿童隐私数据。
- 不新增生产权限，不绕过 MCP API Key、agent session token 或医生复核权限。
- 不让 `demo_mode` 改变生产 API 行为。
- 不输出诊断、处方或未复核正式报告。

## Source of Truth

- 量表目录、题目 schema、交付模式与确定性计分：`lib/scales/catalog.ts`。
- MCP tool contract：`lib/mcp/skills/scale/handlers.ts` 与 `packages/assessment-skill/src/service/mcp-manifest.ts`。
- Skill facade 鉴权与 route contract：`packages/assessment-skill/src/contracts/http.ts`、`app/api/skill/v1/*`。
- 医生复核边界：`resultDeliveryMode = physician_review`、`DoctorReview(PENDING)` 与患者端报告门控。
- 演示数据：新增的本地 demo JSON，只能保存合成身份、合成作答和 `DEMO_ONLY` 水印。

## 模块边界

- `packages/assessment-skill/demo/phase8-demo-cases.json`：5 个合成案例，包含 `demo_mode: true`、`synthetic_data_only: true`、`watermark: DEMO_ONLY`。
- `scripts/skill-mcp-phase8-demo.mjs`：本地 replay 脚本，读取 demo JSON，校验隐私字段，生成 MCP JSON-RPC 调用链，并对可本地确定执行的 `score_assessment` 做确定性校验。
- `packages/assessment-skill/README.md`：说明比赛演示链路、运行命令、安全边界和医生复核措辞。
- `packages/assessment-skill/src/service/mcp-manifest.ts`：只补充 manifest 的 demo metadata，不新增生产权限。
- `tests/phase8-skill-mcp-demo.test.ts`：覆盖 demo 数据隐私、`demo_mode` 标记、MCP replay 链路、manifest metadata 和生产接口权限边界。

## 调用链与数据流

演示 replay 调用链：

1. `tools/list` / `list_supported_scales`：展示目录与交付模式。
2. `get_scale_schema`：展示量表题目、选项和 `doctorReviewRequired`。
3. `create_assessment_session`：展示生产会话创建所需参数；脚本只生成 JSON-RPC payload，不伪造数据库 session。
4. `generate_assessment_link`：展示 Web Handoff 入口；脚本只展示调用参数和安全说明。
5. `map_natural_language_answer` / `confirm_mapped_answer`：展示 AI 只能给候选映射，低置信度必须确认。
6. `submit_answer`：展示答案提交 payload。
7. `score_assessment`：脚本调用本地确定性计分引擎，输出非正式 preview。
8. `get_assessment_result`：展示结果查询 payload，并明确 `physician_review` 结果等待医生复核。

生产接口数据流不变：外部调用必须经 MCP API Key 或 agent session token；医生报告与正式可见性必须经医生复核。

## 风险与验证

- 隐私风险：测试禁止真实身份字段、手机号、身份证、生日、住址、真实姓名等字段或模式进入 demo JSON。
- 权限风险：测试确认 Skill session/answer/result route 仍调用 `authenticateSkillRequest`，MCP route 仍走 `handleSseGet`/`handleSsePost`，MCP auth 仍校验 API Key。
- 计分风险：测试调用 demo script 的 replay 函数，确认两次计分结果一致，且来自 `evaluateScaleAnswers`。
- 临床安全风险：README 与 replay 输出必须标注 `DEMO_ONLY`、非诊断、非处方、正式报告需医生复核。

验收命令：

```bash
rtk npm run skill:build
rtk node --test --import tsx tests/phase8-skill-mcp-demo.test.ts
```
