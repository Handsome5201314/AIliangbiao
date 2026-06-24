# Phase 7 科研导入导出和研究衍生表实施计划

## 目标与非目标

目标：支持历史 CSV 导入、人工字段映射、缺失值/质量标记、HMAC 脱敏研究编号、科研衍生表导出，并在导出中复算 3 个月主结局和次要结局字段。

非目标：

- 不导出姓名、电话、门诊号、住院号、身份证号、设备原始标识等直接身份字段。
- 不允许 AI 自由生成字段规则；导出字段只来自固定字段字典。
- 不把缺失值默认当作 `0`；缺失必须保留为 `null`/空单元格，并进入质量标记。
- 不绕过科研同意、医生边界或科研导出权限。

## Source of Truth

- 字段字典：`docs/developmental-behavior-closure/08_RESEARCH_DATA_DICTIONARY.md` 和 `lib/services/research-export.ts` 中的固定字段定义。
- 脱敏编号：`RESEARCH_EXPORT_SECRET` HMAC-SHA256 派生；没有密钥时导出应失败，不使用默认开发密钥伪装成功。
- 科研同意：`ResearchConsent.status = GRANTED` 是进入全量科研导出的必要条件。
- 权限：全量 `/api/research/export` 与 `/api/research/import` 仅允许 `SUPER_ADMIN` / `AUDITOR`；医生个人患者导出继续走 `exportDoctorPatientResearchData` 的医生-患者边界和同意检查。
- 导入映射：由调用方显式提交 `fieldMapping`，并落库为批次/字段映射；服务只校验固定 canonical 字段，不推断字段含义。
- 主结局：基线后 75-105 天内完成 3 个月复测；缺基线日期或缺随访日期时不能记为完成。

## Module 边界

- `lib/services/research-export.ts`
  - 固定字段字典、去标识化、衍生表构建、主/次要结局计算、CSV/JSON 序列化、导出批次落库。
- `lib/services/research-import.ts`
  - CSV 解析、字段映射校验、行级质量标记、脱敏编号生成、导入批次/导入行/字段映射落库。
- `app/api/research/export/route.ts`
  - 只做认证授权、参数解析和响应头；不拼字段、不计算结局。
- `app/api/research/import/route.ts`
  - 只做认证授权、请求体验证和调用导入服务。
- `prisma/schema.prisma`
  - 补齐 `ResearchImportRow`、`ResearchFieldMapping`、`ResearchDerivedDataset`，并让 `ResearchExportLog` 支持全量科研导出批次。
- `tests/research-p0-contract.test.ts`
  - 锁住脱敏、窗口计算、缺失值质量标记、权限、批次落库和字段字典合同。

## Interface 契约

导出服务：

```ts
exportResearchDataset({
  format: 'json' | 'csv',
  actor?: { actorType: 'ADMIN' | 'DOCTOR'; actorId: string; adminId?: string; userId?: string; doctorProfileId?: string },
  purpose?: string,
  persistBatch?: boolean,
})
```

导入服务：

```ts
importHistoricalResearchCsv({
  sourceName: string,
  csvContent: string,
  fieldMapping: Record<string, ResearchDerivedFieldName>,
  actor?: { requestedByUserId?: string; uploadedByDoctorProfileId?: string },
  persistBatch?: boolean,
})
```

错误形状：服务层抛出明确 `Error`；API 返回 `{ error }` 和 401/403/400/500。导出/导入失败不能当空数据成功。

## 数据流

历史 CSV -> `research-import` 显式字段映射 -> `ResearchImportBatch` / `ResearchFieldMapping` / `ResearchImportRow` -> 衍生字段行。

生产数据 -> 已授权科研同意成员 -> 基线/评估/随访/报告/健康教育/住院/结局模型 -> `buildResearchDerivedRows` -> `ResearchDerivedDataset` + `ResearchExportLog` -> CSV/JSON。

前端/脚本/API 不拥有字段规则，只传格式、用途和导入映射。

## 风险与验证

- 直接身份泄漏：测试固定禁止姓名、电话、门诊号、住院号、住院 admissionId 和设备原始标识。
- 主结局错误：测试 75、90、105 天为完成，74、106 天为未完成。
- 缺失值误算：测试历史导入缺 `baseline_score` 时输出 `null`，并产生 `MISSING_BASELINE_SCORE`。
- 权限绕过：测试全量导出 API 不再 fallback 到普通 approved doctor。
- 批次未落库：测试导出服务包含 `ResearchDerivedDataset` 与 `ResearchExportLog` 持久化路径；导入服务包含批次、字段映射和行级记录。

## 执行步骤

1. 在 `tests/research-p0-contract.test.ts` 先补失败测试。
2. 实现 `lib/services/research-import.ts` 的纯解析/校验函数和持久化入口。
3. 重构 `lib/services/research-export.ts`，补固定字段字典、衍生行、主/次要结局、批次落库和更严格脱敏。
4. 收紧 `app/api/research/export/route.ts` 的全量科研导出权限，并新增 `app/api/research/import/route.ts`。
5. 补 `prisma/schema.prisma` 与 migration SQL。
6. 更新 `08_RESEARCH_DATA_DICTIONARY.md`。
7. 跑 `npm test -- tests/research-p0-contract.test.ts`、`npx prisma validate`，再视情况跑 `npm test`。
