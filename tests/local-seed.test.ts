import test from "node:test";
import assert from "node:assert/strict";

test("local seed template includes admin, doctor, patient, member, assessments, and system config", async () => {
  const { buildLocalSeedPlan } = await import("../scripts/lib/local-dev-seed.mjs");
  const plan = buildLocalSeedPlan();

  assert.equal(plan.admin.username, "admin");
  assert.equal(plan.doctor.user.accountType, "DOCTOR");
  assert.equal(plan.patient.user.accountType, "PATIENT");
  assert.equal(plan.patient.member.nickname.length > 0, true);
  assert.equal(plan.assessments.length >= 2, true);
  assert.equal(plan.systemConfigs.guestDailyLimit, "5");
  assert.equal(plan.systemConfigs.registeredDailyLimit, "10");
});
