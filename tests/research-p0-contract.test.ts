import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const ADULT_SCALE_IDS = [
  "PHQ-9",
  "GAD-7",
  "SSS",
  "PSQI_18",
  "RSES_10",
  "MBTI",
  "HOLLAND",
  "MMSE_30",
  "MOCA_30",
];

test("adult and exploration scales are removed from source catalogs", async () => {
  for (const scalePath of [
    "data/scales/phq-9.scale.json",
    "data/scales/gad-7.scale.json",
    "data/scales/sss.scale.json",
  ]) {
    await assert.rejects(access(scalePath), /ENOENT/);
  }

  const registry = await readFile("lib/schemas/core/registry.ts", "utf8");
  assert.doesNotMatch(registry, /PSQI_Scale|RSES_Scale|MMSE_Scale|MoCA_Scale|MBTI_Scale|HOLLAND_Scale/);

  const catalog = await readFile("lib/scales/catalog.ts", "utf8");
  assert.doesNotMatch(catalog, /DEFAULT_EXPLORATION_ADULT_METADATA/);
  assert.doesNotMatch(catalog, /listExplorationScales|getExplorationScaleById|normalizeScaleCatalogCategoryParam/);
  assert.doesNotMatch(catalog, /doctorExplorationEnabled/);
  for (const scaleId of ADULT_SCALE_IDS) {
    assert.doesNotMatch(catalog, new RegExp(scaleId.replace("-", "\\-")));
  }

  const h5MockData = await readFile("mobile-h5-prototype/src/data/mockData.ts", "utf8");
  assert.doesNotMatch(h5MockData, /explorationScales/);
  assert.doesNotMatch(h5MockData, /PHQ-9|GAD-7|MBTI|HOLLAND/);
});

test("research P0 Prisma models and export contracts exist", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  for (const modelName of [
    "ChildBaseline",
    "ScaleScore",
    "FollowUp",
    "AiInteraction",
    "ReportView",
    "Outcome3m",
    "InpatientRecord",
  ]) {
    assert.match(schema, new RegExp(`model\\s+${modelName}\\s+{`));
  }

  await access("app/api/research/export/route.ts");
  await access("scripts/exportData.ts");

  const route = await readFile("app/api/research/export/route.ts", "utf8");
  assert.match(route, /exportResearchDataset/);
  assert.match(route, /requireResearchExportAccess/);

  const script = await readFile("scripts/exportData.ts", "utf8");
  assert.match(script, /exportResearchDataset/);
  assert.match(script, /--format/);
  assert.match(script, /--out/);
});

test("research export implementation has explicit deidentification boundaries", async () => {
  const source = await readFile("lib/services/research-export.ts", "utf8");

  assert.match(source, /createResearchSubjectId/);
  assert.match(source, /DIRECT_IDENTIFIER_FIELDS/);
  assert.match(source, /child_baseline/);
  assert.match(source, /assessment_session/);
  assert.match(source, /scale_score/);
  assert.match(source, /ai_interaction/);
  assert.match(source, /followup/);
  assert.match(source, /report_view/);
  assert.match(source, /inpatient_record/);
  assert.match(source, /outcome_3m/);
  assert.doesNotMatch(source, /realName\s*:/);
  assert.doesNotMatch(source, /contactPhone\s*:/);
  assert.doesNotMatch(source, /phone\s*:/);
});

test("H5 and report APIs record research interaction logs", async () => {
  const aiService = await readFile("mobile-h5-prototype/src/services/aiExplanationService.ts", "utf8");
  const assessmentService = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");

  assert.match(aiService, /\/api\/research\/ai-interactions/);
  assert.match(assessmentService, /\/api\/research\/report-views/);
  assert.match(assessmentService, /\/api\/research\/followups/);
});
