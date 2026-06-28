import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildMcpManifest } from "../packages/assessment-skill/src/service/mcp-manifest";

const DEMO_DATA_PATH = "packages/assessment-skill/demo/phase8-demo-cases.json";
const DEMO_SCRIPT_PATH = "scripts/skill-mcp-phase8-demo.mjs";

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function collectStringValues(value: unknown, values: string[] = []) {
  if (typeof value === "string") {
    values.push(value);
    return values;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, values));
    return values;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStringValues(item, values));
  }

  return values;
}

function collectObjectKeys(value: unknown, keys: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectKeys(item, keys));
    return keys;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      keys.push(key);
      collectObjectKeys(item, keys);
    });
  }

  return keys;
}

test("Phase 8 demo data contains five synthetic DEMO_ONLY cases and no real identity fields", async () => {
  const payload = await readJsonFile<{
    demo_mode: boolean;
    synthetic_data_only: boolean;
    watermark: string;
    cases: Array<{
      caseId: string;
      demo_mode: boolean;
      syntheticProfile: unknown;
      answers: number[];
    }>;
  }>(DEMO_DATA_PATH);

  assert.equal(payload.demo_mode, true);
  assert.equal(payload.synthetic_data_only, true);
  assert.equal(payload.watermark, "DEMO_ONLY");
  assert.equal(payload.cases.length, 5);

  const forbiddenIdentityKeys = new Set([
    "name",
    "realname",
    "fullname",
    "childname",
    "guardianname",
    "phone",
    "mobile",
    "idcard",
    "nationalid",
    "birthday",
    "birthdate",
    "address",
    "school",
    "medicalrecordno",
    "patientid",
  ]);

  for (const demoCase of payload.cases) {
    assert.match(demoCase.caseId, /^demo-[a-z0-9-]+$/);
    assert.equal(demoCase.demo_mode, true, `${demoCase.caseId} must carry demo_mode`);
    assert.ok(Array.isArray(demoCase.answers));
    assert.ok(demoCase.answers.length > 0);

    const keys = collectObjectKeys(demoCase.syntheticProfile).map((key) =>
      key.toLowerCase().replaceAll("_", "").replaceAll("-", "")
    );
    for (const key of keys) {
      assert.ok(!forbiddenIdentityKeys.has(key), `${demoCase.caseId} includes forbidden identity key ${key}`);
    }
  }

  const allStrings = collectStringValues(payload);
  for (const value of allStrings) {
    assert.doesNotMatch(value, /1[3-9]\d{9}/, `demo string looks like a mainland phone number: ${value}`);
    assert.doesNotMatch(value, /\b\d{17}[\dXx]\b/, `demo string looks like a mainland ID number: ${value}`);
  }
});

test("Phase 8 MCP replay script builds and runs a deterministic demo call chain", async () => {
  const moduleUrl = pathToFileURL(`${process.cwd()}/${DEMO_SCRIPT_PATH}`).href;
  const demoModule = await import(moduleUrl);

  assert.equal(typeof demoModule.buildPhase8DemoReplay, "function");
  assert.equal(typeof demoModule.runPhase8DemoReplay, "function");

  const replay = await demoModule.buildPhase8DemoReplay({ includeResults: false });
  assert.equal(replay.demo_mode, true);
  assert.equal(replay.synthetic_data_only, true);
  assert.equal(replay.watermark, "DEMO_ONLY");
  assert.equal(replay.cases.length, 5);

  const firstCase = replay.cases[0];
  const firstCaseToolNames = firstCase.mcpCalls.map((call: { params?: { name?: string } }) => call.params?.name);
  for (const toolName of [
    "list_supported_scales",
    "get_scale_schema",
    "create_assessment_session",
    "submit_answer",
    "score_assessment",
    "get_assessment_result",
  ]) {
    assert.ok(firstCaseToolNames.includes(toolName), `replay should include ${toolName}`);
  }

  assert.ok(
    replay.cases.some((demoCase: { mcpCalls: Array<{ params?: { name?: string } }> }) =>
      demoCase.mcpCalls.some((call) => call.params?.name === "generate_assessment_link")
    ),
    "at least one case should demonstrate Web Handoff"
  );

  const firstRun = await demoModule.runPhase8DemoReplay({ quiet: true });
  const secondRun = await demoModule.runPhase8DemoReplay({ quiet: true });
  assert.equal(firstRun.cases.length, 5);

  for (let index = 0; index < firstRun.cases.length; index += 1) {
    const first = firstRun.cases[index];
    const second = secondRun.cases[index];

    assert.deepEqual(first.deterministicScore, second.deterministicScore);
    assert.equal(first.deterministicScore.detailsRedactedForDemo, true);
    assert.equal(first.deterministicScore.rawConclusionRedactedForDemo, true);
    assert.equal("details" in first.deterministicScore, false, "demo replay must not emit unreviewed report details");
    assert.equal("conclusion" in first.deterministicScore, false, "demo replay must not emit unreviewed conclusions");
    assert.equal(first.safety.demo_mode, true);
    assert.equal(first.safety.watermark, "DEMO_ONLY");
    assert.equal(first.safety.formalReportStatus, "doctor_review_required");
    assert.match(first.safety.explanation, /不构成诊断|医生复核/);
  }
});

test("Phase 8 manifest advertises demo metadata without adding production demo scopes", () => {
  const manifest = buildMcpManifest() as ReturnType<typeof buildMcpManifest> & {
    demoPackage?: {
      phase: string;
      modeFlag: string;
      syntheticDataOnly: boolean;
      requiredWatermark: string;
      productionPermissionsUnchanged: boolean;
    };
  };

  assert.deepEqual(manifest.demoPackage, {
    phase: "phase8_skill_mcp_competition",
    modeFlag: "demo_mode",
    syntheticDataOnly: true,
    requiredWatermark: "DEMO_ONLY",
    productionPermissionsUnchanged: true,
  });

  const scopes = manifest.tools.map((tool) => tool.scope);
  assert.ok(!scopes.some((scope) => scope.includes("demo")), "demo package must not introduce demo production scopes");
});

test("Phase 8 docs describe reproducible demo commands and doctor-review safety boundaries", async () => {
  const readme = await readFile("packages/assessment-skill/README.md", "utf8");
  const plan = await readFile("docs/developmental-behavior-closure/19_PHASE8_SKILL_MCP_DEMO_PLAN.md", "utf8");

  assert.match(readme, /skill-mcp-phase8-demo\.mjs/);
  assert.match(readme, /DEMO_ONLY/);
  assert.match(readme, /demo_mode/);
  assert.match(readme, /不构成诊断|非诊断/);
  assert.match(readme, /医生复核/);
  assert.match(plan, /Source of Truth/);
  assert.match(plan, /不新增生产权限/);
});

test("Phase 8 demo mode does not loosen production MCP or Skill authorization", async () => {
  const productionSources = await Promise.all(
    [
      "app/api/mcp/route.ts",
      "lib/mcp/transport.ts",
      "lib/mcp/auth.ts",
      "app/api/skill/v1/scales/[scaleId]/sessions/route.ts",
      "app/api/skill/v1/scales/[scaleId]/sessions/[sessionId]/answer/route.ts",
      "app/api/skill/v1/scales/[scaleId]/sessions/[sessionId]/result/route.ts",
    ].map(async (filePath) => ({
      filePath,
      source: await readFile(filePath, "utf8"),
    }))
  );

  const byPath = new Map(productionSources.map((item) => [item.filePath, item.source]));

  assert.match(byPath.get("app/api/mcp/route.ts") ?? "", /handleSseGet/);
  assert.match(byPath.get("app/api/mcp/route.ts") ?? "", /handleSsePost/);
  assert.match(byPath.get("lib/mcp/transport.ts") ?? "", /validateMcpApiKey/);
  assert.match(byPath.get("lib/mcp/auth.ts") ?? "", /isActive:\s*true/);
  assert.match(
    byPath.get("app/api/skill/v1/scales/[scaleId]/sessions/route.ts") ?? "",
    /authenticateSkillRequest\(request,\s*['"]skill:scales:evaluate['"]\)/
  );
  assert.match(
    byPath.get("app/api/skill/v1/scales/[scaleId]/sessions/[sessionId]/answer/route.ts") ?? "",
    /authenticateSkillRequest\(request,\s*['"]skill:scales:evaluate['"]\)/
  );
  assert.match(
    byPath.get("app/api/skill/v1/scales/[scaleId]/sessions/[sessionId]/result/route.ts") ?? "",
    /authenticateSkillRequest\(request,\s*['"]skill:scales:read['"]\)/
  );

  for (const { filePath, source } of productionSources) {
    assert.doesNotMatch(source, /demo_mode|synthetic_data_only|DEMO_ONLY/, `${filePath} must not branch on demo mode`);
  }
});

test("MCP production tool audit writes canonical calls to McpToolLog", async () => {
  const source = await readFile("lib/mcp/auth.ts", "utf8");

  assert.match(source, /export async function logMcpToolCall/);
  assert.match(source, /prisma\.mcpToolLog\.create/);
  assert.match(source, /toolName:\s*input\.toolName/);
  assert.match(source, /status:\s*input\.status/);
  assert.match(source, /success:\s*input\.success/);
  assert.match(source, /argumentsSummary:/);
  assert.match(source, /resultSummary:/);
  assert.doesNotMatch(source, /prisma\.mcpLog\.create/);
});
