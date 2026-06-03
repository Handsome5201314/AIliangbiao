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
  assert.equal(typeof service.assertAiToyPartnerToken, "function");
  assert.equal(typeof service.ensureAiToyDeviceBindingForDevice, "function");
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
  assert.match(source, /autoCreateBinding/);
  assert.match(source, /ensureAiToyDeviceBindingForDevice/);
  assert.match(source, /assertAiToyDeviceBinding/);
  assert.match(source, /AiToyPartnerAuthError/);
  assert.match(source, /entrypoint:\s*body\.entrypoint/);
  assert.match(source, /memberId:\s*member\.id/);
});

test("AI toy partner token helper accepts only the configured bearer token", async () => {
  const previous = process.env.AI_TOY_PARTNER_TOKEN;
  process.env.AI_TOY_PARTNER_TOKEN = "partner-secret";

  try {
    const service = await import("../lib/services/ai-toy-device-binding");

    assert.doesNotThrow(() => service.assertAiToyPartnerToken("Bearer partner-secret"));
    assert.throws(
      () => service.assertAiToyPartnerToken("Bearer wrong-secret"),
      /Invalid AI toy partner token/
    );
    assert.throws(
      () => service.assertAiToyPartnerToken(null),
      /Missing AI toy partner token/
    );
  } finally {
    if (previous === undefined) {
      delete process.env.AI_TOY_PARTNER_TOKEN;
    } else {
      process.env.AI_TOY_PARTNER_TOKEN = previous;
    }
  }
});

test("agent session auto-create rejects missing AI toy partner token with 401", async () => {
  const previous = process.env.AI_TOY_PARTNER_TOKEN;
  process.env.AI_TOY_PARTNER_TOKEN = "partner-secret";

  try {
    const { POST } = await import("../app/api/agent/session/route");
    const request = new Request("http://localhost/api/agent/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "xiaozhi-test-device",
        entrypoint: "agent",
        clientKind: "ai_toy",
        autoCreateBinding: true,
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.match(body.error, /Missing AI toy partner token/);
  } finally {
    if (previous === undefined) {
      delete process.env.AI_TOY_PARTNER_TOKEN;
    } else {
      process.env.AI_TOY_PARTNER_TOKEN = previous;
    }
  }
});

test("AI toy auto-create reuses an existing active binding without overwriting it", async () => {
  const service = await import("../lib/services/ai-toy-device-binding");
  const { prisma } = await import("../lib/db/prisma");
  const bindingModel = (prisma as any).aiToyDeviceBinding;
  const userModel = (prisma as any).user;

  const originalBindingFindUnique = bindingModel.findUnique;
  const originalBindingUpdate = bindingModel.update;
  const originalBindingCreate = bindingModel.create;
  const originalUserFindUnique = userModel.findUnique;
  const calls = { create: 0, update: 0 };

  bindingModel.findUnique = async (args: any) => {
    assert.deepEqual(args.where, { deviceId: "toy-registered" });
    return {
      id: "binding-1",
      deviceId: "toy-registered",
      userId: "registered-user",
      memberProfileId: "member-1",
      status: "ACTIVE",
      boundAt: new Date(),
      unboundAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };
  bindingModel.update = async () => {
    calls.update += 1;
    throw new Error("existing active binding must not be updated");
  };
  bindingModel.create = async () => {
    calls.create += 1;
    throw new Error("existing active binding must not be recreated");
  };
  userModel.findUnique = async (args: any) => {
    assert.deepEqual(args.where, { id: "registered-user" });
    return {
      id: "registered-user",
      role: "REGISTERED",
      isGuest: false,
      accountType: "PATIENT",
      doctorProfile: null,
      profiles: [
        {
          id: "member-1",
          userId: "registered-user",
          nickname: "本人",
          relation: "SELF",
        },
      ],
    };
  };

  try {
    const resolved = await service.ensureAiToyDeviceBindingForDevice({
      deviceId: " toy-registered ",
      memberSnapshot: { nickname: "不应覆盖" },
    });

    assert.equal(resolved.user.id, "registered-user");
    assert.equal(resolved.member.id, "member-1");
    assert.equal(resolved.binding.userId, "registered-user");
    assert.deepEqual(calls, { create: 0, update: 0 });
  } finally {
    bindingModel.findUnique = originalBindingFindUnique;
    bindingModel.update = originalBindingUpdate;
    bindingModel.create = originalBindingCreate;
    userModel.findUnique = originalUserFindUnique;
  }
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
