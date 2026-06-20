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
