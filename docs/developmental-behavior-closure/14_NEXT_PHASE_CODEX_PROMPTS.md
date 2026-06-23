# 14 后续 Phase Codex /goal 提示词

## Phase 1：数据模型与 Prisma schema 扩展

```text
/goal
请在 AIliangbiao 仓库执行 Phase 1：数据模型与 Prisma schema 扩展。

开发目标：
新增或扩展量表授权、医生复核、正式报告、报告模板、健康教育、随访任务、提醒日志、科研导入、AI/MCP 审计模型。保持现有 Next.js + TypeScript + Prisma + PostgreSQL 技术栈。

不允许做什么：
不要实现大规模 UI；不要删除现有模型；不要让 AI 计分；不要绕过医生复核；不要接真实短信；不要写真实儿童隐私数据；不要无 migration 修改数据库。

需要读取哪些文件：
README.md
docs/developmental-behavior-closure/00_PROJECT_BRIEF.md
docs/developmental-behavior-closure/03_DATA_MODEL.md
docs/developmental-behavior-closure/11_PROJECT_HARNESS.md
docs/developmental-behavior-closure/12_CODEX_WORKING_RULES.md
prisma/schema.prisma
tests/research-p0-contract.test.ts

需要修改哪些文件：
prisma/schema.prisma
prisma/migrations/<new_phase1_migration>/migration.sql
tests/<phase1 schema contract test>
必要时更新 docs/developmental-behavior-closure/03_DATA_MODEL.md

需要新增哪些测试：
Prisma schema contract test，验证 DoctorReview、AssessmentReport、ReportTemplate、ScaleLicenseMetadata、EducationContent、EducationDelivery、ResearchImportBatch 或等价模型存在；验证关键索引和外键存在；验证无真实儿童隐私样例。

验收标准：
npx prisma validate 通过；npm test 或相关测试通过；新增模型有 migration；医生复核和报告状态不能被家长或 AI 直接批准；文档同步更新。
```

## Phase 2：MCP/Skill 确定性计分 API

```text
/goal
请执行 Phase 2：MCP/Skill 确定性计分 API 收敛。

开发目标：
统一量表目录、会话、答案提交和确定性计分 API，收敛旧 /api/assessment/save 的前端传分风险，补齐自然语言映射确认和 MCP/Skill 契约。

不允许做什么：
不要让 LLM 输出最终分数或风险等级；不要破坏现有 /api/skill/v1 和 /api/mcp 兼容入口；不要删除目标量表；不要绕过医生复核。

需要读取哪些文件：
docs/developmental-behavior-closure/04_MCP_SKILL_CONTRACT.md
docs/developmental-behavior-closure/05_AI_BOUNDARIES.md
lib/scales/catalog.ts
packages/assessment-skill/src/server/scale-service.ts
packages/assessment-skill/src/contracts/http.ts
lib/mcp/skills/scale/handlers.ts
app/api/assessment/save/route.ts
tests/scale-catalog.test.ts
tests/realtime-session.test.ts

需要修改哪些文件：
packages/assessment-skill/src/server/scale-service.ts
packages/assessment-skill/src/contracts/http.ts
lib/mcp/skills/scale/handlers.ts
app/api/assessment/save/route.ts
相关 route tests

需要新增哪些测试：
同一答案多次计分一致；/api/assessment/save 不再信任客户端 totalScore/conclusion；MCP submit/score 使用 evaluateScaleAnswers；低置信度映射需要 confirm。

验收标准：
七个目标量表可查可计分；旧入口不会成为绕过确定性计分的路径；Skill 与 MCP 文档同步；npm test 通过。
```

## Phase 3：医生端门诊评估与医生复核

```text
/goal
请执行 Phase 3：医生端门诊评估与医生复核。

开发目标：
让医生能创建/选择儿童档案、发起目标量表评估、生成 H5 链接、查看完成结果和待复核队列，并创建 DoctorReview。

不允许做什么：
不要做正式报告 PDF；不要让家长端查看未复核结果；不要绕开医生权限；不要大规模重构 doctor 页面。

需要读取哪些文件：
docs/developmental-behavior-closure/06_WORKFLOWS.md
docs/developmental-behavior-closure/07_REPORT_TEMPLATE_SPEC.md
app/doctor/workspace/page.tsx
app/doctor/patients/[memberId]/page.tsx
lib/services/doctor-care.ts
app/api/doctor/**
prisma/schema.prisma

需要修改哪些文件：
lib/services/doctor-care.ts
app/api/doctor/reviews 或合适 route
app/doctor 相关页面
相关 tests

需要新增哪些测试：
未审核医生不能复核；无患者权限医生不能复核；完成评估后进入待复核；复核通过后状态正确；拒绝需要备注。

验收标准：
医生端有待复核入口；DoctorReview 落库；权限测试通过；未复核报告家长不可见。
```

## Phase 4：家长 H5 居家复测

```text
/goal
请执行 Phase 4：家长 H5 居家复测。

开发目标：
支持家长账号登录或医生邀请链接填写复测，提供断点续填、AI 题目解释、低置信度追问确认，并保证免登录链接不能查看正式报告。

不允许做什么：
不要接真实短信；不要把 mockData 用于生产路径；不要显示未复核正式报告；不要让 CARS/VINELAND-3 默认普通家长自助填写。

需要读取哪些文件：
docs/developmental-behavior-closure/06_WORKFLOWS.md
app/assessment/handoff/[token]/page.tsx
app/invite/[token]/page.tsx
mobile-h5-prototype/src/services/assessmentService.ts
packages/assessment-skill/src/server/scale-service.ts
tests/mobile-h5-contract.test.ts

需要修改哪些文件：
Handoff 页面或 mobile H5 服务
相关 API route
相关 tests

需要新增哪些测试：
免登录链接只能提交不能看报告；登录家长只能看自己成员；断点续填保留答案；低置信度需要确认；physician_review 显示等待复核。

验收标准：
H5 复测流程闭环；权限正确；无 mock 进入生产路径；npm test 通过。
```

## Phase 5：正式报告模板与 PDF/打印

```text
/goal
请执行 Phase 5：正式报告模板与 PDF/打印。

开发目标：
实现 DoctorReview -> AssessmentReport -> PDF/打印闭环，提供 SNAP-IV、ABC、通用模板，默认抬头为解放军总医院第一医学中心。

不允许做什么：
不要用照片当报告背景；不要生成诊断结论；不要 AI 审批报告；不要让未复核报告家长可见。

需要读取哪些文件：
docs/developmental-behavior-closure/07_REPORT_TEMPLATE_SPEC.md
lib/services/doctor-care.ts
lib/utils/doctorAssessmentExport.ts
app/doctor/patients/[memberId]/page.tsx
prisma/schema.prisma

需要修改哪些文件：
报告服务层
医生端报告页面/API
家长报告查看 API
PDF/打印工具
相关 tests

需要新增哪些测试：
未复核报告不可见；复核后报告编号生成；模板字段缺失不伪造；PDF/打印 API 需要医生权限；ReportView 记录查看。

验收标准：
SNAP-IV、ABC、通用报告可生成；医生可下载/打印；家长只看已复核报告；npm run lint 和相关测试通过。
```

## Phase 6：健康教育与随访闭环

```text
/goal
请执行 Phase 6：健康教育与随访闭环。

开发目标：
建立人工审核健康教育内容库、内容匹配、触达日志、阅读记录、1 个月/3 个月复测任务和手工提醒记录。

不允许做什么：
不要让 AI 临时编造医学内容；不要接真实短信；不要把提醒失败当成功；不要绕过医生复核触发正式健康教育。

需要读取哪些文件：
docs/developmental-behavior-closure/05_AI_BOUNDARIES.md
docs/developmental-behavior-closure/06_WORKFLOWS.md
prisma/schema.prisma
lib/services/platform-kb-docs.ts
lib/services/research-events.ts
app/admin/knowledge/reviews/page.tsx

需要修改哪些文件：
教育内容模型/服务/API
随访任务服务/API
医生或管理端相关页面
相关 tests

需要新增哪些测试：
未审核内容不可推送；AI 只能匹配已审核内容；触达/阅读落库；3 个月窗口任务生成正确；提醒记录可审计。

验收标准：
健康教育和随访链路可审计；无真实短信依赖；相关测试通过。
```

## Phase 7：科研导入导出和研究衍生表

```text
/goal
请执行 Phase 7：科研导入导出和研究衍生表。

开发目标：
支持历史 CSV 导入、字段映射、缺失值/质量标记、脱敏编号、研究衍生表导出，并计算主结局和次要结局字段。

不允许做什么：
不要导出直接身份字段；不要让 AI 自由生成导出字段规则；不要把缺失值默认当 0；不要跳过科研同意/权限。

需要读取哪些文件：
docs/developmental-behavior-closure/08_RESEARCH_DATA_DICTIONARY.md
lib/services/research-export.ts
lib/services/doctor-care.ts
app/api/research/export/route.ts
tests/research-p0-contract.test.ts
prisma/schema.prisma

需要修改哪些文件：
科研导入服务/API
科研导出服务
字段字典/衍生表测试
相关 docs

需要新增哪些测试：
导出不含姓名电话门诊号住院号；75-105 天窗口计算正确；历史导入质量标记正确；无科研权限不可导出；导出批次落库。

验收标准：
CSV/JSON 导出符合数据字典；主结局可复算；脱敏边界测试通过。
```

## Phase 8：Skill + MCP 比赛演示包

```text
/goal
请执行 Phase 8：Skill + MCP 比赛演示包。

开发目标：
准备 Skill + MCP 演示链路，使用 5 个模拟或脱敏案例，展示量表目录、会话、Handoff、答案提交、确定性计分、医生复核边界和安全解释。

不允许做什么：
不要使用真实儿童隐私数据；不要开启生产权限；不要让 demo_mode 影响生产；不要输出诊断、处方或未复核正式报告。

需要读取哪些文件：
docs/developmental-behavior-closure/04_MCP_SKILL_CONTRACT.md
docs/developmental-behavior-closure/05_AI_BOUNDARIES.md
packages/assessment-skill/README.md
packages/assessment-skill/src/service/mcp-manifest.ts
lib/mcp/skills/scale/handlers.ts
app/api/mcp/route.ts

需要修改哪些文件：
demo 数据/脚本
MCP manifest 或文档
Skill 演示 README
相关测试

需要新增哪些测试：
demo 数据不含真实身份字段；demo_mode 标记存在；MCP 调用链可跑通；生产接口不因 demo 放宽权限。

验收标准：
演示包可复现；调用链清晰；确定性计分；医生复核边界明确；npm run skill:build 和相关测试通过。
```

