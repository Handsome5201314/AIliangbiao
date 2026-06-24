import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

function exportedFunctionBlock(source: string, name: string) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} export is missing`);
  const next = source.indexOf("\nexport ", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("doctor review routes require approved doctor authentication", async () => {
  await access("app/api/doctor/reviews/route.ts");
  await access("app/api/doctor/reviews/[reviewId]/route.ts");

  const listRoute = await readFile("app/api/doctor/reviews/route.ts", "utf8");
  const itemRoute = await readFile("app/api/doctor/reviews/[reviewId]/route.ts", "utf8");

  assert.match(listRoute, /requireApprovedDoctorUser/);
  assert.match(itemRoute, /requireApprovedDoctorUser/);
  assert.match(listRoute, /listDoctorReviews/);
  assert.match(itemRoute, /completeDoctorReview/);
});

test("doctor review service enforces patient write access before completion", async () => {
  const source = await readFile("lib/services/doctor-care.ts", "utf8");
  const block = exportedFunctionBlock(source, "completeDoctorReview");

  assert.match(block, /assertDoctorCanWriteMember/);
  assert.match(block, /memberProfileId/);
  assert.match(block, /doctorProfileId/);
});

test("doctor review decision rejects rejection without notes and normalizes approved visibility", async () => {
  const service = await import("../lib/services/doctor-care");
  assert.equal(typeof service.resolveDoctorReviewDecision, "function");

  assert.throws(
    () =>
      service.resolveDoctorReviewDecision({
        status: "REJECTED",
        reviewNotes: "   ",
      }),
    /备注|required/i
  );

  const approved = service.resolveDoctorReviewDecision({
    status: "APPROVED",
    reviewConclusion: "同意本次量表结果",
    reviewNotes: "已核对原始答案",
    allowParentVisible: true,
  });

  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.allowParentVisible, true);
  assert.ok(approved.completedAt instanceof Date);
});

test("completed physician-review assessments are linked to pending DoctorReview", async () => {
  const doctorCare = await readFile("lib/services/doctor-care.ts", "utf8");
  const assessmentSave = await readFile("app/api/assessment/save/route.ts", "utf8");
  const scaleService = await readFile("packages/assessment-skill/src/server/scale-service.ts", "utf8");
  const clinicScreenings = await readFile("lib/services/clinic-screenings.ts", "utf8");

  assert.match(doctorCare, /ensurePendingDoctorReviewForAssessment/);
  assert.match(doctorCare, /DoctorReviewStatus\.PENDING|status:\s*['"]PENDING['"]/);
  assert.match(assessmentSave, /ensurePendingDoctorReviewForAssessment/);
  assert.match(scaleService, /ensurePendingDoctorReviewForAssessment/);
  assert.match(clinicScreenings, /ensurePendingDoctorReviewForAssessment/);
});

test("patient report route gates unreviewed physician-review results", async () => {
  const route = await readFile("app/api/assessment/history/[assessmentId]/report/route.ts", "utf8");

  assert.match(route, /assertPatientCanViewReviewedAssessmentReport/);
  assert.match(route, /等待医生复核|PENDING_DOCTOR_REVIEW|403/);
});

test("doctor UI exposes pending review queue and patient-level review actions", async () => {
  await access("app/doctor/reviews/page.tsx");

  const layout = await readFile("app/doctor/layout.tsx", "utf8");
  const dashboard = await readFile("app/doctor/page.tsx", "utf8");
  const reviewsPage = await readFile("app/doctor/reviews/page.tsx", "utf8");
  const patientDetail = await readFile("app/doctor/patients/[memberId]/page.tsx", "utf8");

  assert.match(layout, /\/doctor\/reviews/);
  assert.match(layout, /待复核/);
  assert.match(dashboard, /pendingReviewCount/);
  assert.match(reviewsPage, /\/api\/doctor\/reviews/);
  assert.match(patientDetail, /completeDoctorReview|\/api\/doctor\/reviews/);
});

test("doctor patients page can create/select children and start real assessment sessions", async () => {
  const patientsRoute = await readFile("app/api/doctor/patients/route.ts", "utf8");
  const startAssessmentRoute = await readFile(
    "app/api/doctor/patients/[memberId]/assessments/route.ts",
    "utf8"
  );
  const patientsPage = await readFile("app/doctor/patients/page.tsx", "utf8");
  const patientDetail = await readFile("app/doctor/patients/[memberId]/page.tsx", "utf8");

  assert.match(patientsRoute, /export async function POST/);
  assert.match(patientsRoute, /createDoctorTemporaryPatient|createMobileTemporaryMember/);
  assert.match(startAssessmentRoute, /createDoctorPatientAssessmentSession/);
  assert.match(startAssessmentRoute, /requireApprovedDoctorUser/);
  assert.match(patientsPage, /\/api\/doctor\/patients/);
  assert.match(patientDetail, /\/api\/doctor\/patients\/\$\{memberId\}\/assessments/);
});
