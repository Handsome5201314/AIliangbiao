import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_ROLE, canAccessAdminRoles, getAdminRoleLabel, normalizeAdminRole } from "../lib/auth/admin-role";

test("admin role normalization should accept legacy and canonical values", () => {
  assert.equal(normalizeAdminRole("superadmin"), ADMIN_ROLE.SUPER_ADMIN);
  assert.equal(normalizeAdminRole("admin"), ADMIN_ROLE.SUPER_ADMIN);
  assert.equal(normalizeAdminRole("KB_REVIEWER"), ADMIN_ROLE.KB_REVIEWER);
  assert.equal(normalizeAdminRole("ops"), ADMIN_ROLE.OPS);
  assert.equal(normalizeAdminRole("unknown"), null);
});

test("admin role access helper should enforce allowed role lists", () => {
  assert.equal(canAccessAdminRoles(ADMIN_ROLE.SUPER_ADMIN, [ADMIN_ROLE.SUPER_ADMIN]), true);
  assert.equal(canAccessAdminRoles(ADMIN_ROLE.AUDITOR, [ADMIN_ROLE.SUPER_ADMIN]), false);
  assert.equal(canAccessAdminRoles(null, [ADMIN_ROLE.SUPER_ADMIN]), false);
  assert.equal(getAdminRoleLabel(ADMIN_ROLE.OPS), "运维");
});

test("require-admin should support role-based ACL", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("lib/auth/require-admin.ts", "utf8");

  assert.match(source, /options: RequireAdminRequestOptions/);
  assert.match(source, /canAccessAdminRoles/);
  assert.match(source, /rawRole/);
});

test("admin session route should expose current admin info", async () => {
  const route = await import("../app/api/admin/session/route");
  assert.equal(typeof route.GET, "function");
});

test("admin layout should fetch server session and expose organizations navigation", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/layout.tsx", "utf8");

  assert.match(source, /\/api\/admin\/session/);
  assert.match(source, /组织管理/);
  assert.match(source, /审计日志/);
  assert.match(source, /Hermes Profile/);
  assert.match(source, /渠道接入/);
  assert.match(source, /治理策略/);
  assert.match(source, /getAdminRoleLabel/);
});

test("admin dashboard should include role-aware quick links for organizations", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/page.tsx", "utf8");

  assert.match(source, /\/admin\/organizations/);
  assert.match(source, /visibleQuickLinks/);
  assert.match(source, /\/admin\/knowledge\/reviews/);
  assert.match(source, /\/admin\/hermes-profiles/);
  assert.match(source, /\/admin\/channels/);
  assert.match(source, /\/admin\/policies/);
});

test("organization admin route should exist for super admin governance", async () => {
  const route = await import("../app/api/admin/organizations/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.POST, "function");
  assert.equal(typeof route.PATCH, "function");
});

test("audit log admin route should exist for auditors", async () => {
  const route = await import("../app/api/admin/audit-logs/route");
  assert.equal(typeof route.GET, "function");
});

test("knowledge review admin route should exist for KB reviewers", async () => {
  const route = await import("../app/api/admin/knowledge/reviews/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.PATCH, "function");
});

test("hermes profile admin route should exist for super admins", async () => {
  const route = await import("../app/api/admin/hermes-profiles/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.POST, "function");
  assert.equal(typeof route.PATCH, "function");
});

test("channels admin route should exist for governance and ops", async () => {
  const route = await import("../app/api/admin/channels/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.POST, "function");
});

test("policies admin route should exist for super admin governance", async () => {
  const route = await import("../app/api/admin/policies/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.POST, "function");
});

test("hermes profile admin service should list profiles and expose owner candidates", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("lib/services/admin-hermes-profiles.ts", "utf8");

  assert.match(source, /listAdminHermesProfiles/);
  assert.match(source, /organizationCandidates/);
  assert.match(source, /doctorCandidates/);
  assert.match(source, /knowledgeDefaultMode/);
});

test("hermes profile service should normalize runtime config when listing profiles", async () => {
  const { prisma } = await import("../lib/db/prisma");
  const service = await import("../lib/services/admin-hermes-profiles");
  const hermesProfileModel = (prisma as any).hermesProfile;
  const organizationModel = (prisma as any).organization;
  const doctorProfileModel = (prisma as any).doctorProfile;

  const originalFindMany = hermesProfileModel.findMany;
  const originalOrganizationFindMany = organizationModel?.findMany;
  const originalDoctorFindMany = doctorProfileModel.findMany;

  hermesProfileModel.findMany = async () => [
    {
      id: "hermes-1",
      ownerType: "ORGANIZATION",
      organizationId: "org-1",
      doctorProfileId: null,
      displayName: "机构默认 Profile",
      status: "DEGRADED",
      policyJson: { rateLimit: 8 },
      configJson: {
        knowledgeDefaultMode: "direct_fastgpt",
        doctorBotFallbackEnabled: false,
      },
      lastHealthAt: new Date("2026-06-15T08:00:00.000Z"),
      createdAt: new Date("2026-06-14T08:00:00.000Z"),
      updatedAt: new Date("2026-06-15T08:00:00.000Z"),
      organization: {
        id: "org-1",
        name: "儿童发育中心",
        orgCode: "ORG-1",
        status: "ACTIVE",
      },
      doctorProfile: null,
      _count: {
        knowledgeDocs: 3,
      },
    },
  ];
  if (organizationModel?.findMany) {
    organizationModel.findMany = async () => [];
  }
  doctorProfileModel.findMany = async () => [];

  try {
    const result = await service.listAdminHermesProfiles();

    assert.equal(result.profiles[0]?.knowledgeDefaultMode, "direct_fastgpt");
    assert.equal(result.profiles[0]?.doctorBotFallbackEnabled, false);
    assert.equal(result.profiles[0]?.knowledgeDocCount, 3);
  } finally {
    hermesProfileModel.findMany = originalFindMany;
    if (organizationModel?.findMany) {
      organizationModel.findMany = originalOrganizationFindMany;
    }
    doctorProfileModel.findMany = originalDoctorFindMany;
  }
});

test("hermes profile service should reject doctor-level profiles for organization doctors", async () => {
  const { prisma } = await import("../lib/db/prisma");
  const service = await import("../lib/services/admin-hermes-profiles");
  const doctorProfileModel = (prisma as any).doctorProfile;
  const hermesProfileModel = (prisma as any).hermesProfile;

  const originalDoctorFindUnique = doctorProfileModel.findUnique;
  const originalHermesCreate = hermesProfileModel?.create;

  doctorProfileModel.findUnique = async () => ({
    id: "doctor-in-org",
    organizationId: "org-1",
    verificationStatus: "APPROVED",
    realName: "李医生",
    hospitalName: "儿童医院",
    hermesProfile: null,
  });
  if (hermesProfileModel?.create) {
    hermesProfileModel.create = async () => {
      throw new Error("should not create profile for organization doctor");
    };
  }

  try {
    await assert.rejects(
      () =>
        service.createAdminHermesProfile({
          ownerType: "DOCTOR",
          doctorProfileId: "doctor-in-org",
          displayName: "医生个人 Profile",
          knowledgeDefaultMode: "platform_proxy",
          doctorBotFallbackEnabled: true,
        }),
      /组织/
    );
  } finally {
    doctorProfileModel.findUnique = originalDoctorFindUnique;
    if (hermesProfileModel?.create) {
      hermesProfileModel.create = originalHermesCreate;
    }
  }
});

test("knowledge review service should count pending items and record review audits", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("lib/services/admin-knowledge-reviews.ts", "utf8");

  assert.match(source, /countPendingKnowledgeReviewItems/);
  assert.match(source, /KNOWLEDGE_DOC_APPROVED/);
  assert.match(source, /QUESTION_EXPLANATION_REJECTED/);
  assert.match(source, /PENDING_REVIEW/);
});

test("audit log page should call the audit log API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/audits/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/audit-logs/);
  assert.match(source, /审计日志/);
});

test("knowledge review page should call the review API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/knowledge/reviews/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/knowledge\/reviews/);
  assert.match(source, /知识审核/);
  assert.match(source, /审核通过/);
});

test("hermes profile page should call the hermes profile API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/hermes-profiles/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/hermes-profiles/);
  assert.match(source, /Hermes Profile/);
  assert.match(source, /knowledgeDefaultMode/);
});

test("organization admin page should call the organizations API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/organizations/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/organizations/);
  assert.match(source, /组织管理/);
  assert.match(source, /Hermes Profile/);
});

test("channels admin page should call the channels API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/channels/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/channels/);
  assert.match(source, /渠道接入/);
  assert.match(source, /Webhook/);
});

test("policies admin page should call the policies API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/policies/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/policies/);
  assert.match(source, /治理策略/);
  assert.match(source, /敏感访问/);
});

test("admin policies should not expose adult exploration catalog governance", async () => {
  const { DEFAULT_ADMIN_POLICIES } = await import("../lib/services/admin-policies");

  assert.doesNotMatch(JSON.stringify(DEFAULT_ADMIN_POLICIES), /doctorExplorationEnabled|exploration/i);
});

test("policies admin page should not expose the doctor exploration governance switch", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/policies/page.tsx", "utf8");

  assert.doesNotMatch(source, /doctorExplorationEnabled/);
  assert.doesNotMatch(source, /探索测试/);
});
