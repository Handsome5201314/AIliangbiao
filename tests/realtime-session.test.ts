import test from "node:test";
import assert from "node:assert/strict";

import { issueAgentSessionToken } from "../lib/assessment-skill/auth";

test("agent session token preserves scopes and identity for realtime runtime consumption", () => {
  const issued = issueAgentSessionToken({
    userId: "user-1",
    memberId: "member-1",
    role: "REGISTERED",
    deviceId: "device-1",
    accountType: "PATIENT",
    entrypoint: "agent",
  });

  assert.equal(issued.payload.sub, "user-1");
  assert.equal(issued.payload.member_id, "member-1");
  assert.equal(issued.payload.device_id, "device-1");
  assert.equal(issued.payload.entrypoint, "agent");
  assert.ok(issued.payload.scopes.includes("skill:scales:read"));
  assert.ok(issued.payload.scopes.includes("skill:voice-intent"));
});

test("realtime runtime config should expose hermes defaults and fallback flags", async () => {
  const { getRealtimeRuntimeConfig } = await import("../lib/realtime/config");
  const config = await getRealtimeRuntimeConfig();

  assert.equal(config.provider, "hermes");
  assert.equal(config.mode, "sdk");
  assert.equal(config.fallbacks.voiceIntent, true);
  assert.equal(config.fallbacks.speechToText, true);
  assert.equal(config.fallbacks.doctorBot, true);
  assert.ok(Array.isArray(config.allowedSurfaces));
  assert.ok(config.allowedSurfaces.includes("agent"));
  assert.ok(config.allowedSurfaces.includes("doctor_bot"));
});

test("realtime tool catalog should isolate doctor-only capabilities", async () => {
  const { listRealtimeToolDescriptors } = await import("../lib/realtime/tools");

  const patientTools = listRealtimeToolDescriptors({
    surface: "agent",
    accountType: "PATIENT",
  });
  const doctorTools = listRealtimeToolDescriptors({
    surface: "agent",
    accountType: "DOCTOR",
    doctorProfileId: "doctor-1",
  });

  assert.ok(patientTools.some((tool) => tool.name === "assessment.start"));
  assert.ok(patientTools.some((tool) => tool.name === "handoff.escalate"));
  assert.ok(!patientTools.some((tool) => tool.name === "doctor.invite.create"));

  assert.ok(doctorTools.some((tool) => tool.name === "doctor.invite.create"));
  assert.ok(doctorTools.some((tool) => tool.name === "doctor.triage.redirect"));
});

test("doctor bot runtime bootstrap should reject unpublished doctor bots before opening realtime surface", async () => {
  const { createDoctorBotBootstrapState } = await import("../lib/realtime/doctor-bot-bootstrap");

  await assert.rejects(
    () =>
      createDoctorBotBootstrapState({
        slug: "missing-bot",
        deviceId: "guest-device",
      }),
    /not found|not published/i
  );
});

test("realtime session module should export a route handler contract", async () => {
  const route = await import("../app/api/realtime/session/route");
  assert.equal(typeof route.POST, "function");
});

test("agent config route should remain available for workspace fallback", async () => {
  const route = await import("../app/api/agent/config/route");
  assert.equal(typeof route.GET, "function");
});

test("agent workspace config should expose unified shell and Hermes rollout toggles", async () => {
  const { getAgentWorkspaceConfig } = await import("../lib/agent/config");
  const config = await getAgentWorkspaceConfig();

  assert.equal(typeof config.rollout?.unifiedShellEnabled, "boolean");
  assert.equal(typeof config.rollout?.hermesBackendEnabled, "boolean");
  assert.equal(typeof config.rollout?.publicShareUsesUnifiedShell, "boolean");
  assert.equal(typeof config.rollout?.experimentalVoiceEnabled, "boolean");
  assert.equal(config.rollout?.knowledgeDefaultMode, "platform_proxy");
});

test("agent mode router should recognize public share as a first-class mode", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/AgentModeRouter.tsx", "utf8");

  assert.match(source, /public_share/);
  assert.match(source, /ConversationShell mode="public_share"/);
});

test("realtime bootstrap should include ui mode, voice mode, and knowledge routing defaults", async () => {
  const file = await import("node:fs/promises");
  const routeSource = await file.readFile("lib/realtime/session.ts", "utf8");

  assert.match(routeSource, /uiMode/);
  assert.match(routeSource, /voiceMode/);
  assert.match(routeSource, /knowledge/);
  assert.match(routeSource, /platform_proxy/);
});

test("Hermes conversation proxy route should exist for shared conversation turns", async () => {
  const route = await import("../app/api/realtime/conversation/route");
  assert.equal(typeof route.POST, "function");
});

test("doctor bot public message route should remain available during conversation proxy migration", async () => {
  const route = await import("../app/api/chat/[slug]/message/route");
  assert.equal(typeof route.POST, "function");
});

test("doctor bot public message route should delegate through shared conversation service", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/api/chat/[slug]/message/route.ts", "utf8");

  assert.match(source, /sendDoctorBotConversationTurn/);
});

test("doctor workspace route should remain available while Hermes rollout settings are added", async () => {
  const route = await import("../app/api/doctor/workspace/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.POST, "function");
});

test("agent workspace should reference the shared realtime conversation entry for text turns", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/AgentWorkspace.tsx", "utf8");

  assert.match(source, /\/api\/realtime\/conversation/);
});

test("agent workspace text flow should stop calling voice-intent directly for text triage", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/AgentWorkspace.tsx", "utf8");

  const planGoalSectionStart = source.indexOf("const planGoal = useCallback");
  const planGoalSectionEnd = source.indexOf("const handleVoiceStateChange = useCallback");
  const planGoalSection = source.slice(planGoalSectionStart, planGoalSectionEnd);

  assert.doesNotMatch(planGoalSection, /\/api\/skill\/v1\/voice-intent/);
  assert.doesNotMatch(planGoalSection, /VOICE_INTENT_API/);
  assert.match(planGoalSection, /payload\.agentAction/);
});

test("realtime conversation route should expose agentAction and triageSessionPatch for agent surface", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/api/realtime/conversation/route.ts", "utf8");

  assert.match(source, /agentAction/);
  assert.match(source, /triageSessionPatch/);
});

test("doctor workspace response shape should include Hermes rollout and knowledge mode settings", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/doctor/workspace/page.tsx", "utf8");

  assert.match(source, /hermes/i);
  assert.match(source, /knowledge/i);
});

test("doctor bot config service should persist Hermes rollout and knowledge mode fields", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("lib/services/doctor-bot.ts", "utf8");

  assert.match(source, /hermesEnabled/);
  assert.match(source, /knowledgeMode/);
});

test("production compose should document Hermes service wiring", async () => {
  const file = await import("node:fs/promises");
  const compose = await file.readFile("docker-compose.prod.yml", "utf8");

  assert.match(compose, /hermes:/);
  assert.match(compose, /HERMES_API_SERVER_BASE_URL/);
  assert.match(compose, /HERMES_API_SERVER_KEY/);
});

test("production env example should include Hermes runtime variables", async () => {
  const file = await import("node:fs/promises");
  const env = await file.readFile(".env.production.example", "utf8");

  assert.match(env, /HERMES_API_SERVER_BASE_URL/);
  assert.match(env, /HERMES_API_SERVER_KEY/);
  assert.match(env, /HERMES_API_SERVER_MODEL/);
});

test("development compose should include Hermes service wiring", async () => {
  const file = await import("node:fs/promises");
  const compose = await file.readFile("docker-compose.dev.yml", "utf8");

  assert.match(compose, /hermes:/);
  assert.match(compose, /8642/);
});

test("local env example should include Hermes runtime variables", async () => {
  const file = await import("node:fs/promises");
  const env = await file.readFile(".env.local.example", "utf8");

  assert.match(env, /HERMES_API_SERVER_BASE_URL/);
  assert.match(env, /HERMES_API_SERVER_KEY/);
  assert.match(env, /HERMES_API_SERVER_MODEL/);
});

test("package scripts should expose a one-command local full startup entry", async () => {
  const file = await import("node:fs/promises");
  const pkg = JSON.parse(await file.readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(typeof pkg.scripts?.["dev:services"], "string");
  assert.equal(typeof pkg.scripts?.["dev:full"], "string");
});

test("conversation backend resolution should fall back to legacy when Hermes rollout is disabled", async () => {
  const { resolveConversationBackend } = await import("../lib/realtime/conversation");

  assert.equal(
    resolveConversationBackend({
      requestedBackend: "hermes",
      hermesEnabled: false,
    }),
    "legacy"
  );
});

test("conversation backend resolution should honor Hermes when rollout is enabled", async () => {
  const { resolveConversationBackend } = await import("../lib/realtime/conversation");

  assert.equal(
    resolveConversationBackend({
      requestedBackend: "hermes",
      hermesEnabled: true,
    }),
    "hermes"
  );
});

test("Hermes tool-call normalization should produce an assessment action card", async () => {
  const { normalizeHermesReply } = await import("../lib/realtime/conversation");

  const normalized = normalizeHermesReply({
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
  assert.equal(normalized.actionCard?.reason, "持续焦虑症状需要结构化评估");
});

test("Hermes response extraction should prefer assistant output_text blocks", async () => {
  const { extractTextFromOutput } = await import("../lib/realtime/hermes");

  const text = extractTextFromOutput([
    {
      type: "message",
      role: "assistant",
      content: [
        { type: "output_text", text: "Structured " },
        { type: "output_text", text: "reply" },
      ],
    },
    {
      type: "text",
      text: "fallback",
    },
  ]);

  assert.equal(text, "Structured reply");
});

test("doctor bot conversation service module should exist for backend switching", async () => {
  const service = await import("../lib/realtime/doctor-bot-conversation");
  assert.equal(typeof service.sendDoctorBotConversationTurn, "function");
});

test("doctor bot conversation service should reference knowledge mode selection", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("lib/realtime/doctor-bot-conversation.ts", "utf8");

  assert.match(source, /knowledgeMode/);
});

test("agent conversation service module should exist for shared triage turns", async () => {
  const service = await import("../lib/realtime/agent-conversation");
  assert.equal(typeof service.sendAgentConversationTurn, "function");
});
