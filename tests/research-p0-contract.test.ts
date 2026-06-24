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
  const service = await import("../lib/services/research-export");

  assert.match(source, /createResearchSubjectId/);
  assert.match(source, /DIRECT_IDENTIFIER_FIELDS/);
  assert.match(source, /RESEARCH_DERIVED_FIELD_DICTIONARY/);
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

  for (const fieldName of [
    "realName",
    "contactPhone",
    "phone",
    "outpatientNo",
    "inpatientNo",
    "admissionId",
    "deviceId",
    "respondentRealName",
    "respondentPhone",
  ]) {
    assert.equal(
      service.DIRECT_IDENTIFIER_FIELDS.has(fieldName),
      true,
      `${fieldName} must be blocked as a direct identifier`
    );
  }

  const derivedFieldNames: string[] = service.RESEARCH_DERIVED_FIELD_DICTIONARY.map((field) => field.name);
  for (const forbiddenName of ["realName", "contactPhone", "phone", "outpatientNo", "inpatientNo", "admissionId"]) {
    assert.equal(derivedFieldNames.includes(forbiddenName), false, `${forbiddenName} must not be a derived export field`);
  }
});

test("three-month primary outcome uses inclusive 75-105 day window", async () => {
  const { isThreeMonthWindowCompleted } = await import("../lib/services/research-export");
  const baselineDate = "2026-01-01T00:00:00.000Z";

  assert.equal(isThreeMonthWindowCompleted({ baselineDate, completedAt: "2026-03-16T00:00:00.000Z" }), false);
  assert.equal(isThreeMonthWindowCompleted({ baselineDate, completedAt: "2026-03-17T00:00:00.000Z" }), true);
  assert.equal(isThreeMonthWindowCompleted({ baselineDate, completedAt: "2026-04-01T00:00:00.000Z" }), true);
  assert.equal(isThreeMonthWindowCompleted({ baselineDate, completedAt: "2026-04-16T00:00:00.000Z" }), true);
  assert.equal(isThreeMonthWindowCompleted({ baselineDate, completedAt: "2026-04-17T00:00:00.000Z" }), false);
  assert.equal(isThreeMonthWindowCompleted({ baselineDate: null, completedAt: "2026-04-01T00:00:00.000Z" }), false);
  assert.equal(isThreeMonthWindowCompleted({ baselineDate, completedAt: null }), false);
});

test("historical CSV import marks missing values without coercing score to zero", async () => {
  const { buildHistoricalResearchImportRows } = await import("../lib/services/research-import");
  const result = buildHistoricalResearchImportRows({
    csvContent: "姓名,基线日期,总分,是否复测\n小明,2026-01-01,,是",
    fieldMapping: {
      基线日期: "baseline_date",
      总分: "baseline_score",
      是否复测: "three_month_reassessment_completed",
    },
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].normalized.baseline_score, null);
  assert.equal(result.rows[0].normalized.baseline_date, "2026-01-01");
  assert.equal(result.rows[0].normalized.three_month_reassessment_completed, true);
  assert.deepEqual(result.rows[0].qualityFlags, ["MISSING_BASELINE_SCORE"]);
  assert.equal(result.qualitySummary.totalRows, 1);
  assert.equal(result.qualitySummary.rowsWithQualityFlags, 1);
  assert.equal(result.qualitySummary.flagCounts.MISSING_BASELINE_SCORE, 1);
});

test("global research export API requires research export permission instead of generic doctor access", async () => {
  const route = await readFile("app/api/research/export/route.ts", "utf8");

  assert.match(route, /requireResearchExportAccess/);
  assert.match(route, /requireAdminRequest/);
  assert.match(route, /ADMIN_ROLE\.SUPER_ADMIN/);
  assert.match(route, /ADMIN_ROLE\.AUDITOR/);
  assert.doesNotMatch(route, /requireApprovedDoctorUser/);
});

test("doctor patient research export uses HMAC research subject id instead of raw member id slices", async () => {
  const source = await readFile("lib/services/doctor-care.ts", "utf8");
  const start = source.indexOf("export async function exportDoctorPatientResearchData");
  assert.notEqual(start, -1, "exportDoctorPatientResearchData must exist");
  const end = source.indexOf("\nexport async function", start + 1);
  const block = source.slice(start, end === -1 ? undefined : end);

  assert.match(block, /createResearchSubjectId/);
  assert.match(block, /research_subject_id/);
  assert.doesNotMatch(block, /memberProfile\.id\.slice/);
  assert.doesNotMatch(block, /memberStudyId/);
});

test("research import and export batches are persisted with derived dataset models", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const exportSource = await readFile("lib/services/research-export.ts", "utf8");
  const importSource = await readFile("lib/services/research-import.ts", "utf8");

  for (const modelName of ["ResearchImportRow", "ResearchFieldMapping", "ResearchDerivedDataset"]) {
    assert.match(schema, new RegExp(`model\\s+${modelName}\\s+{`));
  }

  assert.match(exportSource, /logResearchExportBatch/);
  assert.match(exportSource, /researchExportLog/);
  assert.match(exportSource, /exportLogModel\.create/);
  assert.match(exportSource, /researchDerivedDataset/);
  assert.match(exportSource, /derivedDatasetModel\.create/);
  assert.match(importSource, /researchImportBatch\.create/);
  assert.match(importSource, /researchFieldMapping\.createMany/);
  assert.match(importSource, /researchImportRow\.createMany/);
});

test("H5 and report APIs record research interaction logs", async () => {
  const aiService = await readFile("mobile-h5-prototype/src/services/aiExplanationService.ts", "utf8");
  const assessmentService = await readFile("mobile-h5-prototype/src/services/assessmentService.ts", "utf8");

  assert.match(aiService, /\/api\/research\/ai-interactions/);
  assert.match(assessmentService, /\/api\/research\/report-views/);
  assert.match(assessmentService, /\/api\/research\/followups/);
});
