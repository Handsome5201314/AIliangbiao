import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("root home renders the migrated Vite H5 app for mobile instead of a hand-written mobile shell", async () => {
  const pageSource = await readFile("app/page.tsx", "utf8");

  assert.match(pageSource, /MobileH5App/);
  assert.match(pageSource, /@\/components\/mobile-h5\/MobileH5App/);
  assert.doesNotMatch(pageSource, /function MobileHome\(/);
  assert.doesNotMatch(pageSource, /智伴童行 H5/);
});

test("migrated H5 keeps the original Vite app structure and visual markers", async () => {
  const requiredPaths = [
    "components/mobile-h5/MobileH5App.tsx",
    "components/mobile-h5/screens/patient/HomeScreen.tsx",
    "components/mobile-h5/screens/shared/AssessmentRunner.tsx",
    "components/mobile-h5/screens/ai/AiAssistantDrawer.tsx",
    "components/mobile-h5/services/authService.ts",
    "components/mobile-h5/services/assessmentService.ts",
    "components/mobile-h5/types/index.ts",
  ];

  for (const path of requiredPaths) {
    await access(path);
  }

  const appSource = await readFile("components/mobile-h5/MobileH5App.tsx", "utf8");
  const homeSource = await readFile("components/mobile-h5/screens/patient/HomeScreen.tsx", "utf8");

  assert.match(appSource, /data-component="mobile-app"/);
  assert.match(appSource, /data-component="bottom-tab-nav"/);
  assert.match(homeSource, /data-component="home-screen"/);
  assert.match(homeSource, /智伴童行 · 儿童发育筛查/);
});

test("main Tailwind config exposes the Vite H5 design tokens inside the Next build", async () => {
  const source = await readFile("tailwind.config.ts", "utf8");

  assert.match(source, /components\/mobile-h5/);
  assert.match(source, /sage:\s*\{/);
  assert.match(source, /cream:\s*\{/);
  assert.match(source, /rounded-card/);
  assert.match(source, /touch:\s*['"]44px['"]/);
  assert.match(source, /slideInUp/);
});

test("migrated H5 services use same-origin APIs and never import mock data or Vite env", async () => {
  const servicePaths = [
    "components/mobile-h5/services/authService.ts",
    "components/mobile-h5/services/assessmentService.ts",
    "components/mobile-h5/services/aiExplanationService.ts",
  ];

  for (const path of servicePaths) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /import\.meta\.env/);
    assert.doesNotMatch(source, /@\/data\/mockData/);
    assert.doesNotMatch(source, /mock-guest|mock-aus|generateMockToken/);
  }
});

test("H5 guest login is backed by a real server-issued app session", async () => {
  const routeSource = await readFile("app/api/auth/guest/route.ts", "utf8");
  const authServiceSource = await readFile("components/mobile-h5/services/authService.ts", "utf8");

  assert.match(authServiceSource, /\/api\/auth\/guest/);
  assert.match(routeSource, /QuotaManager\.getOrCreateGuest/);
  assert.match(routeSource, /issueAppSessionToken/);
  assert.match(routeSource, /accountType:\s*['"]PATIENT['"]/);
});

test("migrated H5 runner maps current-question natural language answers through real Skill APIs", async () => {
  const runnerSource = await readFile("components/mobile-h5/screens/shared/AssessmentRunner.tsx", "utf8");
  const serviceSource = await readFile("components/mobile-h5/services/assessmentService.ts", "utf8");
  const typesSource = await readFile("components/mobile-h5/types/index.ts", "utf8");
  const appSource = await readFile("components/mobile-h5/MobileH5App.tsx", "utf8");

  assert.match(serviceSource, /export async function mapNaturalLanguageAnswer/);
  assert.match(serviceSource, /\/api\/skill\/v1\/voice-intent/);
  assert.match(serviceSource, /mode:\s*['"]questionnaire['"]/);
  assert.match(serviceSource, /export async function confirmMappedAnswer/);
  assert.match(serviceSource, /\/api\/skill\/v1\/scales\/\$\{encodeURIComponent\(params\.scaleId\)\}\/mapped-answers\/confirm/);
  assert.match(serviceSource, /getAuthHeaders\(\)/);

  assert.match(runnerSource, /data-component="ai-answer-mapping-panel"/);
  assert.match(runnerSource, /mapNaturalLanguageAnswer\(/);
  assert.match(runnerSource, /confirmMappedAnswer\(/);
  assert.match(runnerSource, /confirmedLowConfidence:\s*true/);
  assert.match(runnerSource, /source:\s*['"]user_confirmed_mapping['"]/);
  assert.match(runnerSource, /source:\s*['"]ai_mapped['"]/);

  assert.match(typesSource, /confidence\?:\s*number/);
  assert.match(typesSource, /source\?:\s*'manual'\s*\|\s*'ai_mapped'\s*\|\s*'user_confirmed_mapping'/);
  assert.match(typesSource, /confirmedLowConfidence\?:\s*boolean/);

  assert.match(appSource, /handleOpenAi\(question\?: Question,\s*questionNumber\?: number\)/);
  assert.match(runnerSource, /onOpenAi\(currentQuestion,\s*currentIndex \+ 1\)/);
});

test("migrated H5 submission preserves AI answer details for deterministic backend scoring", async () => {
  const serviceSource = await readFile("components/mobile-h5/services/assessmentService.ts", "utf8");
  const saveRoute = await readFile("app/api/assessment/save/route.ts", "utf8");
  const answerDetails = await readFile("lib/scales/answer-details.ts", "utf8");
  const coreTypes = await readFile("lib/schemas/core/types.ts", "utf8");

  assert.match(serviceSource, /function buildAnswerDetails/);
  assert.match(serviceSource, /answerDetails:\s*buildAnswerDetails\(answers\)/);
  assert.match(serviceSource, /confidence:\s*answer\.confidence/);
  assert.match(serviceSource, /confirmedLowConfidence:\s*answer\.confirmedLowConfidence/);

  assert.match(saveRoute, /normalizeScaleAnswerDetails/);
  assert.match(saveRoute, /assertConfirmedLowConfidenceAnswers/);
  assert.match(saveRoute, /answerDetails:\s*normalizedAnswerDetails/);
  assert.match(saveRoute, /LOW_CONFIDENCE_CONFIRMATION_REQUIRED/);

  assert.match(answerDetails, /source\?:\s*ScaleAnswerDetailInput\["source"\]/);
  assert.match(coreTypes, /confidence\?:\s*number/);
  assert.match(coreTypes, /confirmedLowConfidence\?:\s*boolean/);
  assert.match(coreTypes, /source\?:\s*'manual'\s*\|\s*'ai_mapped'\s*\|\s*'user_confirmed_mapping'/);
});
