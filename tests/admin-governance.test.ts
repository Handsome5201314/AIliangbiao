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
  assert.doesNotMatch(source, /Hermes Profile|hermes-profiles/i);
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
  assert.doesNotMatch(source, /\/admin\/hermes-profiles/);
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

test("organization admin page should call the organizations API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/admin/organizations/page.tsx", "utf8");

  assert.match(source, /\/api\/admin\/organizations/);
  assert.match(source, /组织管理/);
  assert.doesNotMatch(source, /Hermes Profile|hermesProfileCount/i);
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
