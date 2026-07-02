import test from "node:test";
import assert from "node:assert/strict";

import { issueAgentSessionToken } from "../lib/assessment-skill/auth";

test("agent session token preserves identity and tenant metadata without runtime profile IDs", () => {
  const issued = issueAgentSessionToken({
    userId: "user-1",
    memberId: "member-1",
    role: "REGISTERED",
    deviceId: "device-1",
    accountType: "PATIENT",
    entrypoint: "agent",
    organizationId: "org-1",
    channel: "wechat_h5",
    tenantRole: "PATIENT_MEMBER",
  });

  assert.equal(issued.payload.sub, "user-1");
  assert.equal(issued.payload.member_id, "member-1");
  assert.equal(issued.payload.organization_id, "org-1");
  assert.equal(issued.payload.channel, "wechat_h5");
  assert.equal(issued.payload.tenant_role, "PATIENT_MEMBER");
  assert.equal("hermes_profile_id" in issued.payload, false);
  assert.ok(issued.payload.scopes.includes("skill:scales:read"));
});

test("realtime runtime config exposes the internal project runtime", async () => {
  const { getRealtimeRuntimeConfig } = await import("../lib/realtime/config");
  const config = await getRealtimeRuntimeConfig();

  assert.equal(config.provider, "internal");
  assert.equal(config.mode, "sdk");
  assert.equal(config.fallbacks.voiceIntent, true);
  assert.equal(config.fallbacks.speechToText, true);
  assert.equal(config.fallbacks.doctorBot, true);
  assert.ok(config.allowedSurfaces.includes("agent"));
  assert.ok(config.allowedSurfaces.includes("doctor_bot"));
});

test("realtime tool catalog keeps doctor-only capabilities isolated", async () => {
  const { listRealtimeToolDescriptors } = await import("../lib/realtime/tools");

  const patientTools = listRealtimeToolDescriptors({ surface: "agent", accountType: "PATIENT" });
  const doctorTools = listRealtimeToolDescriptors({
    surface: "agent",
    accountType: "DOCTOR",
    doctorProfileId: "doctor-1",
  });

  assert.ok(patientTools.some((tool) => tool.name === "assessment.start"));
  assert.ok(!patientTools.some((tool) => tool.name === "doctor.invite.create"));
  assert.ok(doctorTools.some((tool) => tool.name === "doctor.invite.create"));
});

test("realtime session and conversation routes remain available", async () => {
  const sessionRoute = await import("../app/api/realtime/session/route");
  const conversationRoute = await import("../app/api/realtime/conversation/route");
  const doctorBotRoute = await import("../app/api/chat/[slug]/message/route");

  assert.equal(typeof sessionRoute.POST, "function");
  assert.equal(typeof conversationRoute.POST, "function");
  assert.equal(typeof doctorBotRoute.POST, "function");
});

test("agent config no longer exposes embedded Hermes rollout toggles", async () => {
  const { getAgentWorkspaceConfig } = await import("../lib/agent/config");
  const config = await getAgentWorkspaceConfig();

  assert.equal(typeof config.rollout?.unifiedShellEnabled, "boolean");
  assert.equal(typeof config.rollout?.publicShareUsesUnifiedShell, "boolean");
  assert.equal(typeof config.rollout?.experimentalVoiceEnabled, "boolean");
  assert.equal(config.rollout?.knowledgeDefaultMode, "platform_proxy");
  assert.equal("hermesBackendEnabled" in (config.rollout || {}), false);
});

test("realtime bootstrap keeps ui mode, voice mode, and platform knowledge defaults", async () => {
  const file = await import("node:fs/promises");
  const routeSource = await file.readFile("lib/realtime/session.ts", "utf8");

  assert.match(routeSource, /uiMode/);
  assert.match(routeSource, /voiceMode/);
  assert.match(routeSource, /knowledge/);
  assert.match(routeSource, /platform_proxy/);
  assert.doesNotMatch(routeSource, /hermesProfile|configJson/);
});

test("admin dashboard and compose files do not expose embedded Hermes runtime wiring", async () => {
  const file = await import("node:fs/promises");
  const dashboardService = await file.readFile("lib/services/admin-dashboard.ts", "utf8");
  const dashboardPage = await file.readFile("app/admin/page.tsx", "utf8");
  const prodCompose = await file.readFile("docker-compose.prod.yml", "utf8");
  const devCompose = await file.readFile("docker-compose.dev.yml", "utf8");
  const prodEnv = await file.readFile(".env.production.example", "utf8");
  const localEnv = await file.readFile(".env.local.example", "utf8");

  for (const source of [dashboardService, dashboardPage, prodCompose, devCompose, prodEnv, localEnv]) {
    assert.doesNotMatch(source, /Hermes|hermes|HERMES/);
  }
  assert.match(prodCompose, /app:/);
  assert.match(prodCompose, /db:/);
});

test("conversation backend resolution is fixed to the internal project runtime", async () => {
  const { resolveConversationBackend, normalizeConversationReply } = await import("../lib/realtime/conversation");

  assert.equal(resolveConversationBackend({}), "internal");
  const normalized = normalizeConversationReply({
    content: "建议先做一个标准评估。",
    toolCall: {
      name: "suggest_assessment",
      args: {
        scaleId: "GAD-7",
        reason: "持续焦虑症状需要结构化评估",
        cardTitle: "开始 GAD-7",
        cardBody: "这能帮助更准确地理解当前焦虑情况。",
      },
    },
  });

  assert.equal(normalized.text, "建议先做一个标准评估。");
  assert.equal(normalized.actionCard?.scaleId, "GAD-7");
});

test("doctor bot and agent conversation services remain as project-owned orchestration", async () => {
  const doctorBotService = await import("../lib/realtime/doctor-bot-conversation");
  const agentService = await import("../lib/realtime/agent-conversation");

  assert.equal(typeof doctorBotService.sendDoctorBotConversationTurn, "function");
  assert.equal(typeof agentService.sendAgentConversationTurn, "function");
});
