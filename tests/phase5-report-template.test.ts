import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function exportedFunctionBlock(source: string, name: string) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} export is missing`);
  const next = source.indexOf("\nexport ", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("formal report template resolver provides SNAP-IV, ABC, and generic defaults", async () => {
  const template = await import("../lib/utils/assessmentReportTemplate");

  const snap = template.resolveAssessmentReportTemplateConfig("SNAP-IV");
  const abc = template.resolveAssessmentReportTemplateConfig("ABC");
  const generic = template.resolveAssessmentReportTemplateConfig("VINELAND_3");

  assert.equal(snap.kind, "SNAP_IV");
  assert.equal(abc.kind, "ABC");
  assert.equal(generic.kind, "GENERAL");
  assert.equal(snap.hospitalName, "解放军总医院第一医学中心");
  assert.match(snap.reportTitle, /SNAP-IV/);
  assert.match(abc.reportTitle, /ABC|孤独症行为/);
  assert.match(generic.reportTitle, /正式报告/);
});

test("formal report snapshot does not invent missing optional fields", async () => {
  const template = await import("../lib/utils/assessmentReportTemplate");

  const snapshot = template.buildAssessmentReportSnapshot({
    reportNo: "RPT-SNAP-IV-20260624-ABC123",
    template: template.resolveAssessmentReportTemplateConfig("SNAP-IV"),
    assessment: {
      id: "assessment-1",
      scaleId: "SNAP-IV",
      scaleVersion: "1.0",
      totalScore: 12,
      conclusion: "建议结合临床访谈继续评估",
      resultDetails: {
        dimensions: {
          attention: { label: "注意缺陷", score: 6, maxScore: 27 },
        },
      },
      createdAt: new Date("2026-06-24T08:00:00.000Z"),
    },
    member: {
      id: "member-1",
      nickname: "小朋友A",
      realName: null,
      contactPhone: null,
      gender: "男",
      ageMonths: null,
    },
    doctor: {
      id: "doctor-1",
      realName: "王医生",
      title: "主治医师",
      hospitalName: "解放军总医院第一医学中心",
      departmentName: "发育行为儿科",
    },
    review: {
      id: "review-1",
      reviewConclusion: "同意本次量表结果",
      reviewNotes: null,
      completedAt: new Date("2026-06-24T09:00:00.000Z"),
    },
    approvedAt: new Date("2026-06-24T09:00:00.000Z"),
  });

  assert.equal(snapshot.child.displayName, "小朋友A");
  assert.equal(snapshot.child.contactPhone, null);
  assert.equal(snapshot.child.ageMonths, null);
  assert.equal(snapshot.optional.outpatientNo, null);
  assert.equal(snapshot.optional.inpatientNo, null);
  assert.equal(snapshot.optional.clinicalDiagnosis, null);

  const html = template.renderAssessmentReportHtml(snapshot);
  assert.doesNotMatch(html, /未知|默认|N\/A/);
  assert.doesNotMatch(html, /确诊|诊断结论/);
});

test("doctor review approval creates an approved report number and non-approval hides reports", async () => {
  const source = await readFile("lib/services/doctor-care.ts", "utf8");
  const block = exportedFunctionBlock(source, "completeDoctorReview");

  assert.match(block, /ensureApprovedAssessmentReportForReview/);
  assert.match(block, /ensureReportHiddenForReview/);
  assert.match(source, /buildAssessmentReportNo/);
  assert.match(source, /reportStatus:\s*['"]APPROVED['"]/);
  assert.match(source, /parentVisible:\s*decision\.allowParentVisible/);
});

test("patient report visibility only trusts approved AssessmentReport and records parent views", async () => {
  const service = await readFile("lib/services/doctor-care.ts", "utf8");
  const route = await readFile("app/api/assessment/history/[assessmentId]/report/route.ts", "utf8");
  const visibilityBlock = exportedFunctionBlock(service, "assertPatientCanViewReviewedAssessmentReport");

  assert.match(visibilityBlock, /assessmentReport/);
  assert.match(visibilityBlock, /reportStatus:\s*['"]APPROVED['"]/);
  assert.match(visibilityBlock, /parentVisible:\s*true/);
  assert.doesNotMatch(visibilityBlock, /visibleReview/);
  assert.doesNotMatch(visibilityBlock, /allowParentVisible/);
  assert.match(route, /recordReportView/);
  assert.match(route, /viewerRole:\s*['"]PATIENT['"]/);
});

test("doctor report API requires doctor auth, supports print HTML, and records views", async () => {
  const route = await readFile(
    "app/api/doctor/patients/[memberId]/assessments/[assessmentId]/report/route.ts",
    "utf8"
  );

  assert.match(route, /requireApprovedDoctorUser/);
  assert.match(route, /getDoctorAssessmentReport/);
  assert.match(route, /recordReportView/);
  assert.match(route, /viewerRole:\s*['"]DOCTOR['"]/);
  assert.match(route, /searchParams\.get\(['"]format['"]\)/);
  assert.match(route, /renderAssessmentReportHtml/);
  assert.match(route, /text\/html/);
});

test("browser export utility reuses formal report HTML for PDF and exposes print", async () => {
  const exportUtil = await readFile("lib/utils/doctorAssessmentExport.ts", "utf8");
  const templateUtil = await readFile("lib/utils/assessmentReportTemplate.ts", "utf8");

  assert.match(exportUtil, /renderAssessmentReportHtml/);
  assert.match(exportUtil, /downloadDoctorAssessmentPdf/);
  assert.match(exportUtil, /printDoctorAssessmentReport/);
  assert.doesNotMatch(templateUtil, /background-image|backgroundImage/);
});
