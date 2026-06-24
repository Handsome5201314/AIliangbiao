# Phase 5 正式报告模板与 PDF/打印实施计划

## 目标

打通 `DoctorReview -> AssessmentReport -> PDF/打印 -> 家长已复核查看` 闭环。正式报告必须由医生复核通过后生成，默认抬头为“解放军总医院第一医学中心”，第一版支持 SNAP-IV、ABC 和通用量表模板。

## 不做

- 不用照片或扫描图当报告背景，只用 HTML/CSS 重建正式报告版式。
- 不生成诊断结论，不把量表筛查结果写成“确诊”。
- 不做 AI 审批报告；AI 只可作为原始摘要来源，正式报告由医生复核驱动。
- 不让未复核、未批准或未允许家长可见的报告被家长 API 返回。
- 不引入兼容旧动态导出作为正式报告 source of truth。

## Source of Truth

- `AssessmentHistory`：量表原始答案、确定性计分结果、评估时间。
- `DoctorReview`：医生复核状态、备注、复核结论、是否允许家长可见。
- `AssessmentReport`：正式报告编号、模板、状态、快照、家长可见性。Phase 5 后家长报告接口只信任它。
- `ReportTemplate`：报告模板元数据。第一版按 scaleId 解析 SNAP-IV、ABC、通用模板，并在服务层按需写入默认模板记录。
- `ReportView`：医生或家长查看正式报告时的审计记录。

## 模块边界

- `lib/services/doctor-care.ts`
  - 完成医生复核时，如果 `APPROVED`，创建或更新 `AssessmentReport(APPROVED)`。
  - 如果不是通过，已有报告必须变为不可见。
  - 医生正式报告读取只返回已复核正式报告数据。
  - 家长可见性检查只接受 `AssessmentReport(reportStatus=APPROVED,parentVisible=true)`。
- `lib/utils/assessmentReportTemplate.ts`
  - 纯函数模板层：模板选择、报告编号、报告快照、HTML 打印渲染。
  - 不依赖 DOM，不读取数据库，服务端和客户端都可复用。
- `lib/utils/doctorAssessmentExport.ts`
  - 继续负责浏览器端 PDF/Word/CSV/JSON 下载，新增打印工具，并复用正式模板 HTML。
- `app/api/doctor/patients/[memberId]/assessments/[assessmentId]/report/route.ts`
  - 医生鉴权、报告查看审计、JSON 或 print HTML 输出。
- `app/api/assessment/history/[assessmentId]/report/route.ts`
  - 家长鉴权、正式报告可见性门禁、查看审计。
- `app/doctor/patients/[memberId]/page.tsx`
  - 使用正式报告数据下载 PDF，并增加打印入口。

## 数据流

1. 量表完成后已有 Phase 3 逻辑创建 `DoctorReview(PENDING)`。
2. 医生在医生端复核：
   - `REJECTED` / `NEEDS_MORE_INFO`：只记录医生备注，不生成家长可见报告。
   - `APPROVED`：服务层生成报告编号、选择模板、构建 `reportSnapshot`，写入 `AssessmentReport(APPROVED)`。
3. 医生打开报告 API：
   - 必须是审核通过医生。
   - 必须对患者有访问权限。
   - 记录 `ReportView(viewerRole=DOCTOR)`。
   - 默认返回 JSON；`?format=print` 返回可打印 HTML。
4. 家长打开历史报告 API：
   - 必须是登录家长本人。
   - `physician_review` 量表只查已批准且 `parentVisible=true` 的 `AssessmentReport`。
   - 成功后记录 `ReportView(viewerRole=PATIENT)`。

## 验证

- 新增 `tests/phase5-report-template.test.ts`：
  - 未复核报告不可见。
  - 复核后生成正式报告编号。
  - 缺失可选字段不伪造。
  - PDF/打印 API 需要医生权限。
  - `ReportView` 记录医生/家长查看。
- 运行：
  - `rtk npm exec -- tsx --test tests/phase5-report-template.test.ts`
  - `rtk npm exec -- tsx --test tests/phase3-doctor-review.test.ts tests/mobile-h5-contract.test.ts`
  - `rtk npm run lint`
