import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("schema stores AI toy device bindings as one active member binding per device", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");

  assert.match(schema, /model AiToyDeviceBinding/);
  assert.match(schema, /deviceId\s+String/);
  assert.match(schema, /userId\s+String/);
  assert.match(schema, /memberProfileId\s+String/);
  assert.match(schema, /status\s+String\s+@default\("ACTIVE"\)/);
  assert.match(schema, /@@unique\(\[deviceId\]\)/);
  assert.match(schema, /@@index\(\[userId, memberProfileId\]\)/);
});

test("AI toy binding service exposes bind, resolve, unbind, and assertion helpers", async () => {
  const service = await import("../lib/services/ai-toy-device-binding");

  assert.equal(typeof service.bindAiToyDevice, "function");
  assert.equal(typeof service.resolveAiToyDeviceBinding, "function");
  assert.equal(typeof service.unbindAiToyDevice, "function");
  assert.equal(typeof service.assertAiToyDeviceBinding, "function");
  assert.ok(Array.isArray(service.AI_TOY_VOICE_SCALE_WHITELIST));
  assert.deepEqual(
    service.AI_TOY_VOICE_SCALE_WHITELIST,
    ["PHQ-9", "GAD-7", "SSS", "M_CHAT_R", "SNAP-IV"]
  );
  assert.equal(service.isAiToyVoiceScale("M-CHAT-R"), true);
  assert.equal(service.isAiToyVoiceScale("SNAP"), true);
});

test("AI toy binding routes are available for partner backend binding lifecycle", async () => {
  const collectionRoute = await import("../app/api/ai-toy/devices/route");
  const itemRoute = await import("../app/api/ai-toy/devices/[deviceId]/route");
  const { skillRoutes } = await import("../packages/assessment-skill/src/routes");

  assert.equal(typeof collectionRoute.POST, "function");
  assert.equal(typeof itemRoute.GET, "function");
  assert.equal(typeof itemRoute.DELETE, "function");
  assert.equal(skillRoutes.aiToyDevices, "/api/ai-toy/devices");
  assert.equal(skillRoutes.aiToyDevice("toy-1"), "/api/ai-toy/devices/toy-1");
});

test("agent session route validates AI toy binding only for AI toy clients", async () => {
  const source = await readFile("app/api/agent/session/route.ts", "utf8");

  assert.match(source, /clientKind/);
  assert.match(source, /ai_toy/);
  assert.match(source, /assertAiToyDeviceBinding/);
  assert.match(source, /entrypoint:\s*body\.entrypoint/);
  assert.match(source, /memberId:\s*member\.id/);
});

test("skill scale list can be filtered to voice-friendly AI toy scales", async () => {
  const routeSource = await readFile("app/api/skill/v1/scales/route.ts", "utf8");
  const serviceSource = await readFile("packages/assessment-skill/src/server/scale-service.ts", "utf8");
  const bindingSource = await readFile("lib/services/ai-toy-device-binding.ts", "utf8");

  assert.match(routeSource, /aiToy/);
  assert.match(routeSource, /voiceFriendly/);
  assert.match(bindingSource, /AI_TOY_VOICE_SCALE_WHITELIST/);
  assert.match(serviceSource, /listAiToyVoiceSkillScales/);
});

test("AI toy voice scale filtering returns only the configured whitelist", async () => {
  const { listAiToyVoiceSkillScales } = await import("../lib/assessment-skill/scale-service");

  const scaleIds = listAiToyVoiceSkillScales().map((scale) => scale.id);

  assert.deepEqual(scaleIds, ["M_CHAT_R", "SNAP-IV", "GAD-7", "PHQ-9", "SSS"]);
});
