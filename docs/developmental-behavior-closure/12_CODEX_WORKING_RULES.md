# 12 Codex 工作规则

## 每次任务开始前

1. 先读 `docs/developmental-behavior-closure/00_PROJECT_BRIEF.md`。
2. 再读 `11_PROJECT_HARNESS.md` 和本文件。
3. 根据任务 Phase 读取对应文档和关键源码。
4. 先确认 Source of Truth，再决定修改文件。

## 每次计划必须说明

- 修改目标。
- 涉及文件。
- 数据库是否变更。
- 权限和审计影响。
- AI/MCP 是否参与。
- 风险。
- 测试方法。
- 回滚方案。

## 不得违反

- LLM 不计分。
- AI 不诊断。
- AI 不开药或给治疗处方。
- 医生复核必选。
- 不绕过医生复核。
- 未复核报告不可见。
- 科研导出脱敏。
- 量表授权状态必须保留。
- 未授权量表不得写成“已授权”。
- 健康教育内容必须人工审核，AI 不得临时编造。
- 初期不接真实短信。
- 不写真实儿童隐私数据到测试代码。
- 不使用 mock / memory mock db 伪造成果。
- 不无 migration 修改数据库。

## 推荐验证

按风险选择：

- `npm run lint`
- `npm test`
- `npm run ci:check`
- `npm run build`
- `npm run skill:build`
- 相关 API route 的 node:test
- 浏览器或 Playwright smoke check

纯文档任务至少运行 `npm run lint`，或说明未运行原因。

## 文档更新规则

- 架构、模型、权限、AI 边界、MCP 契约变化必须更新本目录对应文档。
- Phase 任务完成后，把高价值经验回写到 `09_PHASED_ROADMAP.md`、`10_ACCEPTANCE_CRITERIA.md` 或后续 Trellis spec。
- 不要让一次性聊天记录成为唯一工程记忆。

## 代码修改规则

- 小步修改，优先复用现有模块。
- 不从当前页面位置直接推导信息架构。
- 不绕开 `lib/scales/catalog.ts`、Prisma、现有 auth、现有 Skill/MCP helper。
- 不在 React 页面里堆业务规则；评估、复核、报告、科研导出逻辑应落到服务层或明确 use case。
- 任何旧接口收敛必须列出影响面和回滚方案。

