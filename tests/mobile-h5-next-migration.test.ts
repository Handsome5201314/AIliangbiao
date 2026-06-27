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
