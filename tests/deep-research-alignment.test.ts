import test from "node:test";
import assert from "node:assert/strict";

test("prisma schema should preserve the deep-research Hermes lifecycle and knowledge metadata fields", async () => {
  const file = await import("node:fs/promises");
  const schema = await file.readFile("prisma/schema.prisma", "utf8");
  const migration = await file.readFile(
    "prisma/migrations/20260627_baseline/migration.sql",
    "utf8"
  );

  assert.match(schema, /enum HermesProfileStatus[\s\S]*DRAFT[\s\S]*READY[\s\S]*DEGRADED[\s\S]*DISABLED/);
  assert.match(schema, /status\s+HermesProfileStatus\s+@default\(READY\)/);
  assert.match(schema, /slug\s+String\?/);
  assert.match(schema, /sourceType\s+String/);
  assert.match(schema, /renderedHtml\s+String\?/);
  assert.match(schema, /reviewComment\s+String\?/);
  assert.match(schema, /metadataJson\s+Json/);
  assert.match(schema, /scaleId\s+String\?/);
  assert.match(schema, /questionId\s+String\?/);
  assert.match(schema, /tokenCount\s+Int\?/);
  assert.match(schema, /embedding\s+Unsupported\("vector"\)\?/);
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector/i);
  assert.match(migration, /CREATE TABLE "KnowledgeChunk"[\s\S]*"embedding" vector/i);
});

test("platform explanation service should separate organization and doctor exact supplements", async () => {
  const service = await import("../lib/services/platform-knowledge");
  const view = service.composeQuestionExplanationView({
    scaleId: "GAD-7",
    scaleTitle: "GAD-7",
    question: {
      id: 1,
      text: "感到紧张、焦虑或急切。",
      colloquial: "最近两周会不会总是觉得绷着？",
      standardExplanation: "平台标准解释",
    },
    language: "zh",
    customExplanations: [
      {
        id: "org-1",
        scopeType: "ORGANIZATION",
        title: "机构补充",
        contentMd: "机构级补充说明",
        priority: 20,
      },
      {
        id: "doctor-1",
        scopeType: "DOCTOR",
        title: "医生补充",
        contentMd: "医生级补充说明",
        priority: 10,
      },
    ],
  });

  assert.equal(view.exact.organization.length, 1);
  assert.equal(view.exact.doctor.length, 1);
  assert.equal(view.exact.organization[0]?.id, "org-1");
  assert.equal(view.exact.doctor[0]?.id, "doctor-1");
});

test("mobile assistant shell should track tabs and current question refresh state from the document design", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/MobileAgentWorkspace.tsx", "utf8");

  assert.match(source, /assistantTab/);
  assert.match(source, /currentQuestionId/);
  assert.match(source, /PlatformKnowledgePanel/);
  assert.match(source, /history/i);
});

test("admin roles should include organization reviewer for knowledge workflows", async () => {
  const { ADMIN_ROLE, normalizeAdminRole, getAdminRoleLabel } = await import("../lib/auth/admin-role");

  assert.equal(ADMIN_ROLE.ORG_REVIEWER, "ORG_REVIEWER");
  assert.equal(normalizeAdminRole("org_reviewer"), ADMIN_ROLE.ORG_REVIEWER);
  assert.equal(getAdminRoleLabel(ADMIN_ROLE.ORG_REVIEWER), "机构审核");
});

test("legacy FastGPT entrypoints should be explicitly marked for rollback-safe coexistence", async () => {
  const file = await import("node:fs/promises");
  const panelSource = await file.readFile("components/FastgptKnowledgePanel.tsx", "utf8");
  const routeSource = await file.readFile("app/api/fastgpt/embed-session/route.ts", "utf8");

  assert.match(panelSource, /legacy/i);
  assert.match(routeSource, /legacy/i);
});

test("ci workflow should include playwright verification and rollback-oriented deploy safeguards from the document", async () => {
  const file = await import("node:fs/promises");
  const workflow = await file.readFile(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /playwright/i);
  assert.match(workflow, /rollback/i);
});
