import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

function modelBlock(source: string, name: string) {
  const marker = `model ${name} `;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} model is missing`);
  const next = source.indexOf("\nmodel ", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("health education schema keeps human review metadata on EducationContent", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const auditEnum = schema.slice(schema.indexOf("enum AuditTargetType"), schema.indexOf("enum CareAssignmentStatus"));
  const educationContent = modelBlock(schema, "EducationContent");

  assert.match(auditEnum, /EDUCATION_CONTENT/);
  assert.match(auditEnum, /EDUCATION_DELIVERY/);
  assert.match(auditEnum, /FOLLOWUP_TASK/);
  assert.match(auditEnum, /REMINDER_LOG/);
  assert.match(educationContent, /reviewedByAdminId\s+String\?/);
  assert.match(educationContent, /reviewedAt\s+DateTime\?/);
  assert.match(educationContent, /reviewComment\s+String\?/);
  assert.match(educationContent, /metadata\s+Json\?/);
});

test("AI education matching only returns approved human-reviewed content", async () => {
  const service = await import("../lib/services/health-education");

  assert.equal(typeof service.selectApprovedEducationContentMatches, "function");
  assert.equal(typeof service.assertCanCreateFormalEducationDelivery, "function");

  const matches = service.selectApprovedEducationContentMatches({
    scaleId: "SNAP-IV",
    riskLevel: "moderate",
    dimensionKeys: ["attention"],
    contents: [
      {
        id: "draft-exact",
        title: "草稿精确匹配",
        status: "DRAFT",
        scaleId: "SNAP-IV",
        riskLevel: "moderate",
        dimensionKey: "attention",
      },
      {
        id: "approved-exact",
        title: "已审核精确匹配",
        status: "APPROVED",
        scaleId: "SNAP-IV",
        riskLevel: "moderate",
        dimensionKey: "attention",
      },
      {
        id: "approved-scale",
        title: "已审核量表匹配",
        status: "APPROVED",
        scaleId: "SNAP-IV",
        riskLevel: null,
        dimensionKey: null,
      },
      {
        id: "rejected-exact",
        title: "已驳回精确匹配",
        status: "REJECTED",
        scaleId: "SNAP-IV",
        riskLevel: "moderate",
        dimensionKey: "attention",
      },
    ],
  });

  assert.deepEqual(
    matches.map((item: { id: string }) => item.id),
    ["approved-exact", "approved-scale"]
  );

  assert.throws(
    () =>
      service.assertCanCreateFormalEducationDelivery({
        reportStatus: "PENDING_DOCTOR_REVIEW",
        doctorReviewStatus: "APPROVED",
      }),
    /医生复核|正式报告|approved/i
  );

  assert.doesNotThrow(() =>
    service.assertCanCreateFormalEducationDelivery({
      reportStatus: "APPROVED",
      doctorReviewStatus: "APPROVED",
    })
  );
});

test("education delivery service records delivery and read events without SMS dependency", async () => {
  await access("lib/services/health-education.ts");
  await access("app/api/education/deliveries/[deliveryId]/read/route.ts");
  await access("app/api/doctor/patients/[memberId]/education/route.ts");

  const service = await readFile("lib/services/health-education.ts", "utf8");
  const readRoute = await readFile("app/api/education/deliveries/[deliveryId]/read/route.ts", "utf8");
  const doctorRoute = await readFile("app/api/doctor/patients/[memberId]/education/route.ts", "utf8");

  assert.match(service, /educationDelivery\.create/);
  assert.match(service, /deliveryStatus:\s*['"]DELIVERED['"]/);
  assert.match(service, /deliveredAt:\s*now/);
  assert.match(service, /educationDelivery\.update/);
  assert.match(service, /readAt:\s*now/);
  assert.match(service, /aiDecisionLog\.create/);
  assert.match(readRoute, /requirePatientUser/);
  assert.match(readRoute, /markEducationDeliveryRead/);
  assert.match(doctorRoute, /requireApprovedDoctorUser/);
  assert.match(doctorRoute, /createEducationDeliveriesForApprovedReport/);
  assert.doesNotMatch(service, /sendSms|sms|短信|tencentcloud|chat\.completions|generateMedicalContent/i);
});

test("admin knowledge review queue includes health education content review", async () => {
  const reviewService = await readFile("lib/services/admin-knowledge-reviews.ts", "utf8");
  const reviewRoute = await readFile("app/api/admin/knowledge/reviews/route.ts", "utf8");
  const reviewPage = await readFile("app/admin/knowledge/reviews/page.tsx", "utf8");

  assert.match(reviewService, /EDUCATION_CONTENT/);
  assert.match(reviewService, /educationContent\.findMany/);
  assert.match(reviewService, /reviewedByAdminId/);
  assert.match(reviewService, /EDUCATION_CONTENT_APPROVED/);
  assert.match(reviewRoute, /EDUCATION_CONTENT/);
  assert.match(reviewPage, /健康教育/);
});

test("doctor education content API creates drafts and submits them for human review", async () => {
  await access("app/api/doctor/education/contents/route.ts");
  await access("app/api/doctor/education/contents/[contentId]/submit-review/route.ts");

  const contentRoute = await readFile("app/api/doctor/education/contents/route.ts", "utf8");
  const submitRoute = await readFile(
    "app/api/doctor/education/contents/[contentId]/submit-review/route.ts",
    "utf8"
  );
  const service = await readFile("lib/services/health-education.ts", "utf8");

  assert.match(contentRoute, /requireApprovedDoctorUser/);
  assert.match(contentRoute, /createEducationContentDraft/);
  assert.match(submitRoute, /submitEducationContentForReview/);
  assert.match(service, /status:\s*['"]DRAFT['"]/);
  assert.match(service, /status:\s*['"]PENDING_REVIEW['"]/);
  assert.doesNotMatch(contentRoute, /status:\s*['"]APPROVED['"]/);
});

test("follow-up service builds 3 month window and keeps failed reminders auditable", async () => {
  const service = await import("../lib/services/follow-up-tasks");

  assert.equal(typeof service.buildFollowUpTaskWindow, "function");
  assert.equal(typeof service.buildDefaultFollowUpTaskPlans, "function");
  assert.equal(typeof service.resolveReminderTaskStatusAfterLog, "function");

  const baselineAt = new Date("2026-06-24T00:00:00.000Z");
  const threeMonth = service.buildFollowUpTaskWindow({
    baselineAt,
    taskType: "THREE_MONTH",
  });

  assert.equal(threeMonth.dueDate.toISOString(), "2026-09-24T00:00:00.000Z");
  assert.equal(threeMonth.windowStartAt.toISOString(), "2026-09-07T00:00:00.000Z");
  assert.equal(threeMonth.windowEndAt.toISOString(), "2026-10-07T00:00:00.000Z");

  const plans = service.buildDefaultFollowUpTaskPlans({
    baselineAt,
    scaleId: "SNAP-IV",
  });
  assert.deepEqual(
    plans.map((item: { taskType: string }) => item.taskType),
    ["ONE_MONTH", "THREE_MONTH"]
  );

  assert.equal(
    service.resolveReminderTaskStatusAfterLog({
      currentTaskStatus: "PENDING",
      reminderStatus: "FAILED",
    }),
    "PENDING"
  );
  assert.equal(
    service.resolveReminderTaskStatusAfterLog({
      currentTaskStatus: "PENDING",
      reminderStatus: "RECORDED",
    }),
    "REMINDED"
  );
});

test("follow-up APIs expose task creation and manual reminder audit trail", async () => {
  await access("app/api/doctor/patients/[memberId]/follow-up-tasks/route.ts");
  await access("app/api/doctor/follow-up-tasks/[taskId]/reminders/route.ts");

  const taskRoute = await readFile("app/api/doctor/patients/[memberId]/follow-up-tasks/route.ts", "utf8");
  const reminderRoute = await readFile("app/api/doctor/follow-up-tasks/[taskId]/reminders/route.ts", "utf8");
  const doctorPage = await readFile("app/doctor/patients/[memberId]/page.tsx", "utf8");

  assert.match(taskRoute, /requireApprovedDoctorUser/);
  assert.match(taskRoute, /createDefaultFollowUpTasks/);
  assert.match(reminderRoute, /recordManualReminder/);
  assert.match(reminderRoute, /FAILED/);
  assert.match(reminderRoute, /MANUAL_PHONE|MANUAL_WECHAT|IN_PERSON/);
  assert.match(doctorPage, /follow-up-tasks/);
  assert.match(doctorPage, /手工提醒|随访任务|复测/);
});
