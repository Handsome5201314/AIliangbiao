import assert from "node:assert/strict";
import test from "node:test";

test("doctor sensitive access ticket service should sign and verify short-lived tickets", async () => {
  process.env.SENSITIVE_ACCESS_SECRET = "test-sensitive-secret";
  const service = await import("../lib/services/doctor-sensitive-access");

  const issued = service.issueSensitiveAccessTicket({
    userId: "user-1",
    doctorProfileId: "doctor-1",
    memberId: "member-1",
    organizationId: "org-1",
    purpose: "门诊复诊前查看敏感病史",
    ttlMinutes: 15,
  });

  const payload = service.verifySensitiveAccessTicket(issued.ticket);
  assert.equal(payload.sub, "user-1");
  assert.equal(payload.doctor_profile_id, "doctor-1");
  assert.equal(payload.member_id, "member-1");
  assert.equal(payload.organization_id, "org-1");
  assert.equal(payload.purpose, "门诊复诊前查看敏感病史");
});

test("doctor sensitive access route should exist", async () => {
  const route = await import("../app/api/platform/v1/doctor/sensitive-access/route");
  assert.equal(typeof route.POST, "function");
});
