import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CURRENT_BASELINE_MIGRATION = "prisma/migrations/20260627_baseline/migration.sql";

async function readSchema() {
  return readFile("prisma/schema.prisma", "utf8");
}

async function readCurrentBaselineMigration() {
  try {
    return await readFile(CURRENT_BASELINE_MIGRATION, "utf8");
  } catch (error) {
    assert.fail(
      `Current baseline migration is missing at ${CURRENT_BASELINE_MIGRATION}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function expectModel(schema: string, modelName: string) {
  assert.match(schema, new RegExp(`model\\s+${modelName}\\s+{`), `${modelName} model is missing`);
}

function expectEnum(schema: string, enumName: string) {
  assert.match(schema, new RegExp(`enum\\s+${enumName}\\s+{`), `${enumName} enum is missing`);
}

function modelBlock(schema: string, modelName: string) {
  const match = schema.match(new RegExp(`model\\s+${modelName}\\s+{[\\s\\S]*?\\n}`));
  assert.ok(match, `${modelName} model is missing`);
  return match[0];
}

function enumBlock(schema: string, enumName: string) {
  const match = schema.match(new RegExp(`enum\\s+${enumName}\\s+{[\\s\\S]*?\\n}`));
  assert.ok(match, `${enumName} enum is missing`);
  return match[0];
}

test("Phase 1 closure schema models and enums exist", async () => {
  const schema = await readSchema();

  for (const enumName of [
    "ScaleLicenseStatus",
    "DoctorReviewStatus",
    "AssessmentReportStatus",
    "ReportTemplateStatus",
    "EducationDeliveryStatus",
    "FollowUpTaskType",
    "FollowUpTaskStatus",
    "ReminderChannel",
    "ReminderStatus",
    "ResearchImportBatchStatus",
    "AiDecisionType",
    "McpToolCallStatus",
  ]) {
    expectEnum(schema, enumName);
  }

  for (const modelName of [
    "ScaleLicenseMetadata",
    "DoctorReview",
    "ReportTemplate",
    "AssessmentReport",
    "EducationContent",
    "EducationDelivery",
    "FollowUpTask",
    "ReminderLog",
    "ResearchImportBatch",
    "AiDecisionLog",
    "McpToolLog",
  ]) {
    expectModel(schema, modelName);
  }
});

test("Phase 1 closure schema preserves doctor-review and deterministic-report boundaries", async () => {
  const schema = await readSchema();
  const license = modelBlock(schema, "ScaleLicenseMetadata");
  const doctorReview = modelBlock(schema, "DoctorReview");
  const report = modelBlock(schema, "AssessmentReport");
  const reminderChannel = enumBlock(schema, "ReminderChannel");
  const reportStatus = enumBlock(schema, "AssessmentReportStatus");

  assert.match(license, /licenseStatus\s+ScaleLicenseStatus\s+@default\(UNKNOWN\)/);
  assert.match(license, /commercialEnabled\s+Boolean\s+@default\(false\)/);
  assert.match(license, /@@unique\(\[scaleId,\s*scaleVersion\]\)/);

  assert.match(doctorReview, /doctorProfileId\s+String/);
  assert.match(doctorReview, /status\s+DoctorReviewStatus\s+@default\(PENDING\)/);
  assert.match(doctorReview, /allowParentVisible\s+Boolean\s+@default\(false\)/);
  assert.match(doctorReview, /durationSeconds\s+Int\?/);

  assert.match(report, /doctorReviewId\s+String/);
  assert.match(report, /approvedByDoctorProfileId\s+String\?/);
  assert.match(report, /parentVisible\s+Boolean\s+@default\(false\)/);
  assert.match(report, /reportStatus\s+AssessmentReportStatus\s+@default\(DRAFT\)/);
  assert.doesNotMatch(report, /approvedByUserId|approvedByAi|aiApproved|parentApproved/i);
  assert.doesNotMatch(reportStatus, /AI_APPROVED|PARENT_APPROVED/);

  assert.doesNotMatch(reminderChannel, /SMS|TENCENT|AUTO/);
});

test("Phase 1 migration creates audit-backed tables with indexes and foreign keys", async () => {
  const migration = await readCurrentBaselineMigration();

  for (const tableName of [
    "scale_license_metadata",
    "doctor_review",
    "report_template",
    "assessment_report",
    "education_content",
    "education_delivery",
    "followup_task",
    "reminder_log",
    "research_import_batch",
    "ai_decision_log",
    "mcp_tool_log",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${tableName}"`), `${tableName} table migration is missing`);
  }

  assert.match(migration, /CREATE UNIQUE INDEX "scale_license_metadata_scaleId_scaleVersion_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "assessment_report_reportNo_key"/);
  assert.match(migration, /CREATE INDEX "doctor_review_status_createdAt_idx"/);
  assert.match(migration, /CREATE INDEX "followup_task_memberProfileId_status_dueDate_idx"/);
  assert.match(migration, /CREATE INDEX "mcp_tool_log_toolName_createdAt_idx"/);
  assert.match(migration, /FOREIGN KEY \("doctorReviewId"\) REFERENCES "doctor_review"\("id"\)/);
  assert.match(migration, /FOREIGN KEY \("templateId"\) REFERENCES "report_template"\("id"\)/);
});

test("Phase 1 schema artifacts do not include real child privacy examples", async () => {
  const schema = await readSchema();
  const migration = await readCurrentBaselineMigration();
  const combined = `${schema}\n${migration}`;

  assert.doesNotMatch(combined, /张三|李四|真实儿童|身份证|手机号/);
  assert.doesNotMatch(combined, /\b1[3-9]\d{9}\b/);
});
