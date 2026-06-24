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

test("mobile H5 auth service uses real auth APIs instead of mock users or mock AUS tokens", async () => {
  const source = await readFile("mobile-h5-prototype/src/services/authService.ts", "utf8");

  assert.doesNotMatch(source, /@\/data\/mockData/);
  assert.doesNotMatch(source, /mockAuthUsers|MOCK_SMS_CODE|MOCK_DOCTOR_PIN/);
  assert.doesNotMatch(source, /mock-aus|mock-guest|generateMockToken/);
  assert.match(source, /\/api\/auth\/sms\/send-code/);
  assert.match(source, /\/api\/auth\/login-sms/);
  assert.match(source, /\/api\/auth\/login/);
  assert.match(source, /\/api\/auth\/me/);
});

test("mobile H5 login screen does not publish test accounts or a fixed SMS code", async () => {
  const source = await readFile("mobile-h5-prototype/src/screens/auth/LoginScreen.tsx", "utf8");

  assert.doesNotMatch(source, /测试账号|测试环境|888888|demo-accounts/);
});

test("mobile H5 assessment flow does not use session-mock or random server failures", async () => {
  const appSource = await readFile("mobile-h5-prototype/src/App.tsx", "utf8");
  const serviceSource = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");

  assert.doesNotMatch(appSource, /session-mock/);
  assert.doesNotMatch(serviceSource, /Math\.random\(\)\s*<|random failure|10% random failure/);
});

test("mobile H5 production services do not import local mockData", async () => {
  const servicePaths = [
    "mobile-h5-prototype/src/services/authService.ts",
    "mobile-h5-prototype/src/services/assessmentService.ts",
    "mobile-h5-prototype/src/services/aiExplanationService.ts",
  ];

  for (const filePath of servicePaths) {
    const source = await readFile(filePath, "utf8");
    assert.doesNotMatch(source, /@\/data\/mockData/, filePath);
  }
});

test("mobile H5 doctor handoff service is wired to real backend contracts", async () => {
  const source = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");
  const requiredEndpoints = [
    "/api/doctor/mobile/temporary-members",
    "/api/doctor/mobile/clinic-screenings",
    "/handoff-lock",
    "/reauth",
  ];

  for (const endpoint of requiredEndpoints) {
    assert.match(source, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  for (const fnName of [
    "createTemporaryPatient",
    "createClinicAssessment",
    "enterCaregiverHandoff",
    "verifyDoctorPin",
  ]) {
    assert.doesNotMatch(exportedFunctionBlock(source, fnName), /throw\s+new\s+Error/);
  }
});

test("mobile H5 doctor fill mode creates a backend session before entering runners", async () => {
  const source = await readFile("mobile-h5-prototype/src/App.tsx", "utf8");

  assert.match(source, /createClinicAssessment\(/);
  assert.match(source, /enterCaregiverHandoff\(/);
  assert.match(source, /activeClinicSessionId/);
});

test("backend exposes mobile doctor handoff route contracts", async () => {
  const routePaths = [
    "app/api/doctor/mobile/temporary-members/route.ts",
    "app/api/doctor/mobile/clinic-screenings/route.ts",
    "app/api/doctor/mobile/clinic-screenings/[sessionId]/handoff-lock/route.ts",
    "app/api/doctor/mobile/clinic-screenings/[sessionId]/reauth/route.ts",
    "app/api/doctor/mobile/reauth/route.ts",
  ];

  for (const routePath of routePaths) {
    await access(routePath);
  }
});

test("public handoff links can save drafts and never expose formal report payloads", async () => {
  const handoffRoute = await readFile("app/api/assessment/handoff/[token]/route.ts", "utf8");
  const submitRoute = await readFile("app/api/assessment/handoff/[token]/submit/route.ts", "utf8");
  const scaleService = await readFile("packages/assessment-skill/src/server/scale-service.ts", "utf8");

  assert.match(handoffRoute, /export async function PATCH/);
  assert.match(handoffRoute, /savePublicAssessmentSessionDraftByToken/);
  assert.match(handoffRoute, /result:\s*null/);
  assert.match(handoffRoute, /assessmentHistoryId:\s*null/);

  assert.match(submitRoute, /confirmedLowConfidence/);
  assert.match(submitRoute, /result:\s*null/);
  assert.match(submitRoute, /assessmentHistoryId:\s*null/);
  assert.match(scaleService, /savePublicAssessmentSessionDraftByToken/);
});

test("logged-in parent H5 surfaces only read the current user's members and reviewed reports", async () => {
  const childrenRoute = await readFile("app/api/profile/sync/route.ts", "utf8");
  const historyRoute = await readFile("app/api/assessment/history/route.ts", "utf8");
  const reportRoute = await readFile("app/api/assessment/history/[assessmentId]/report/route.ts", "utf8");

  assert.match(childrenRoute, /loadAuthenticatedPatientWithProfiles/);
  assert.match(childrenRoute, /where:\s*\{\s*id:\s*session\.sub\s*\}/s);

  assert.match(historyRoute, /requirePatientUser/);
  assert.match(historyRoute, /where:\s*\{\s*id:\s*profileId,\s*userId:\s*user\.id\s*\}/s);
  assert.match(historyRoute, /where:\s*\{\s*userId:\s*user\.id,\s*profileId/s);

  assert.match(reportRoute, /requirePatientUser/);
  assert.match(reportRoute, /userId:\s*user\.id/);
  assert.match(reportRoute, /assertPatientCanViewReviewedAssessmentReport/);
});

test("mobile H5 keeps resumable drafts without treating local drafts as formal reports", async () => {
  const serviceSource = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");
  const runnerSource = await readFile("mobile-h5-prototype/src/screens/shared/AssessmentRunner.tsx", "utf8");

  assert.match(serviceSource, /export async function loadLocalDraft/);
  assert.match(serviceSource, /export async function clearLocalDraft/);
  assert.match(serviceSource, /h5_assessment_draft:last:/);
  assert.doesNotMatch(serviceSource, /window\.sessionStorage\.setItem\(\s*`h5_report:/);

  assert.match(runnerSource, /loadLocalDraft/);
  assert.match(runnerSource, /clearLocalDraft/);
});

test("low-confidence AI-mapped answers require explicit caregiver confirmation before submit", async () => {
  const scaleService = await readFile("packages/assessment-skill/src/server/scale-service.ts", "utf8");
  const submitRoute = await readFile("app/api/assessment/handoff/[token]/submit/route.ts", "utf8");

  assert.match(scaleService, /LOW_CONFIDENCE_CONFIRMATION_THRESHOLD\s*=\s*0\.8/);
  assert.match(scaleService, /LOW_CONFIDENCE_CONFIRMATION_REQUIRED/);
  assert.match(scaleService, /confirmedLowConfidence/);
  assert.match(submitRoute, /confidence:\s*z\.number\(\)\.min\(0\)\.max\(1\)/);
  assert.match(submitRoute, /confirmedLowConfidence:\s*z\.boolean\(\)/);
});

test("physician-review H5 submissions show waiting state instead of unreviewed reports", async () => {
  const serviceSource = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");
  const invitePage = await readFile("app/invite/[token]/page.tsx", "utf8");
  const inviteSubmitRoute = await readFile("app/api/invites/[token]/submit/route.ts", "utf8");

  assert.match(serviceSource, /PENDING_DOCTOR_REVIEW/);
  assert.match(serviceSource, /等待医生复核/);
  assert.match(invitePage, /等待医师审核评估结果|等待医生复核/);
  assert.doesNotMatch(invitePage, /submitResult\.result/);
  assert.match(inviteSubmitRoute, /result:\s*null/);
});

test("ordinary parent self-assessment list excludes doctor-led CARS and VINELAND-3 scales", async () => {
  const serviceSource = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");

  assert.match(serviceSource, /PARENT_SELF_BLOCKED_SCALE_IDS/);
  assert.match(serviceSource, /CARS/);
  assert.match(serviceSource, /VINELAND_3/);
  assert.match(serviceSource, /audience\?:\s*'parent_self'\s*\|\s*'doctor'/);
});

test("mobile H5 AI question explanation uses reviewed backend explanation API", async () => {
  const aiService = await readFile("mobile-h5-prototype/src/services/aiExplanationService.ts", "utf8");

  assert.match(aiService, /\/api\/platform\/v1\/ai\/explanations\/question/);
  assert.match(aiService, /getOrCreateH5DeviceId/);
  assert.match(aiService, /DISCLAIMER/);
});

test("mobile H5 AI helper uses the active scale instead of a hard-coded scale id", async () => {
  const appSource = await readFile("mobile-h5-prototype/src/App.tsx", "utf8");
  const drawerSource = await readFile("mobile-h5-prototype/src/screens/ai/AiAssistantDrawer.tsx", "utf8");
  const fullSource = await readFile("mobile-h5-prototype/src/screens/ai/AiAssistantFull.tsx", "utf8");

  assert.match(appSource, /scaleId=\{selectedScale\?\.id \|\| ''\}/);
  assert.match(drawerSource, /scaleId,\s*questionId/s);
  assert.match(fullSource, /scaleId,\s*questionId/s);
  assert.doesNotMatch(drawerSource, /scaleId:\s*['"]snap-iv['"]/);
  assert.doesNotMatch(fullSource, /scaleId:\s*['"]snap-iv['"]/);
});
