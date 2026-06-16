import assert from "node:assert/strict";
import test from "node:test";

test("platform AI chat stream helper should emit SSE metadata, delta, action, and done events", async () => {
  const { createPlatformAgentChatStreamResponse } = await import("../lib/realtime/platform-chat-stream");

  const response = createPlatformAgentChatStreamResponse({
    conversationId: "agent:session-1",
    language: "zh",
    tenantContext: {
      channel: "ai_toy",
      tenantRole: "PATIENT_MEMBER",
      organizationId: "org-1",
      hermesProfileId: "hermes-1",
    },
    result: {
      backend: "hermes",
      fallback: false,
      message: {
        role: "assistant",
        content: "你好，请先告诉我最困扰你的症状。",
      },
      agentAction: "ask_followup",
      actionCard: null,
      triageSessionPatch: {
        status: "ONGOING",
        symptoms: ["失眠"],
        conversationHistory: [],
        recommendedScale: null,
      },
    },
  });

  assert.match(response.headers.get("Content-Type") || "", /text\/event-stream/i);
  assert.equal(response.headers.get("X-Accel-Buffering"), "no");

  const body = await response.text();
  assert.match(body, /event: meta/);
  assert.match(body, /event: delta/);
  assert.match(body, /event: action/);
  assert.match(body, /event: done/);
  assert.match(body, /ai_toy/);
  assert.match(body, /最困扰你的症状/);
});

test("platform AI chat stream route should reject missing agent token", async () => {
  const { POST } = await import("../app/api/platform/v1/ai/chat/stream/route");

  const response = await POST(
    new Request("http://localhost/api/platform/v1/ai/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          type: "text",
          text: "最近总是睡不好",
        },
      }),
    }) as any
  );

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error, /Missing Bearer token/);
});

test("platform AI chat stream route should exist", async () => {
  const route = await import("../app/api/platform/v1/ai/chat/stream/route");
  assert.equal(typeof route.POST, "function");
});

test("platform channel webhook route should reject missing AI toy partner token", async () => {
  const { POST } = await import("../app/api/platform/v1/channels/[channel]/webhook/route");

  process.env.AI_TOY_PARTNER_TOKEN = "partner-secret";

  const response = await POST(
    new Request("http://localhost/api/platform/v1/channels/ai_toy/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId: "toy-device-1",
        message: "孩子最近总发脾气",
      }),
    }) as any,
    {
      params: Promise.resolve({ channel: "ai_toy" }),
    }
  );

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error, /Missing AI toy partner token/);
});

test("platform channel webhook route should exist", async () => {
  const route = await import("../app/api/platform/v1/channels/[channel]/webhook/route");
  assert.equal(typeof route.POST, "function");
});

test("platform admin review and audit alias routes should exist", async () => {
  const reviewRoute = await import("../app/api/platform/v1/admin/reviews/knowledge/route");
  const approveRoute = await import(
    "../app/api/platform/v1/admin/reviews/knowledge/[id]/approve/route"
  );
  const rejectRoute = await import(
    "../app/api/platform/v1/admin/reviews/knowledge/[id]/reject/route"
  );
  const auditRoute = await import("../app/api/platform/v1/admin/audit-logs/route");

  assert.equal(typeof reviewRoute.GET, "function");
  assert.equal(typeof approveRoute.POST, "function");
  assert.equal(typeof rejectRoute.POST, "function");
  assert.equal(typeof auditRoute.GET, "function");
});
