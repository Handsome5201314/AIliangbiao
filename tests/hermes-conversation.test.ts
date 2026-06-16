import test from "node:test";
import assert from "node:assert/strict";

import type { TriageContext, TriageAIResponse } from "../lib/services/triageFlow";
import {
  buildAgentConversationResultFromTriageAI,
  buildAgentHermesPrompt,
} from "../lib/realtime/agent-conversation";

test("buildAgentHermesPrompt includes triage state, member summary, and user message", () => {
  const prompt = buildAgentHermesPrompt({
    content: "孩子最近总是回避眼神交流。",
    triageContext: {
      state: "triage",
      symptoms: ["社交回应少"],
      conversationHistory: [],
      consentGiven: false,
      language: "zh",
      userProfile: {
        childName: "小宝",
        childAge: 42,
        relation: "mother",
        recentConcerns: ["回避眼神交流"],
      },
    },
    memberContextSummary: {
      nickname: "小宝",
      relation: "self",
      latestAssessmentConclusion: "近期暂无评估记录",
    },
  });

  assert.match(prompt, /当前分诊状态：triage/);
  assert.match(prompt, /小宝/);
  assert.match(prompt, /近期暂无评估记录/);
  assert.match(prompt, /孩子最近总是回避眼神交流/);
});

test("buildAgentConversationResultFromTriageAI creates an assessment action card and consent patch", () => {
  const triageContext: TriageContext = {
    state: "triage",
    symptoms: ["社交回应少"],
    conversationHistory: [
      { role: "user", content: "孩子不太理人", timestamp: 1 },
    ],
    consentGiven: false,
    language: "zh",
  };

  const aiResponse: TriageAIResponse = {
    text: "我建议先做 ABC 量表，这样能更结构化地了解当前表现。",
    action: "recommend_scale",
    scaleId: "ABC",
    confidence: 0.95,
    symptoms: ["社交回应少", "语言沟通少"],
  };

  const result = buildAgentConversationResultFromTriageAI({
    aiResponse,
    triageContext,
    language: "zh",
  });

  assert.equal(result.agentAction, "recommend_scale");
  assert.equal(result.actionCard?.scaleId, "ABC");
  assert.equal(result.triageSessionPatch.status, "CONSENT");
  assert.equal(result.triageSessionPatch.recommendedScale, "ABC");
  assert.equal(result.triageSessionPatch.conversationHistory.at(-1)?.role, "assistant");
});

test("realtime conversation route should delegate doctor_bot surface through shared conversation service", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/api/realtime/conversation/route.ts", "utf8");

  assert.match(source, /sendDoctorBotConversationTurn/);
});

test("doctor bot message route should not force Hermes off", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/api/chat/[slug]/message/route.ts", "utf8");

  assert.doesNotMatch(source, /hermesEnabled:\s*false/);
});

test("Hermes agent stream helper should request upstream stream mode and accumulate output_text deltas", async () => {
  const previousBaseUrl = process.env.HERMES_API_SERVER_BASE_URL;
  const previousApiKey = process.env.HERMES_API_SERVER_KEY;
  const originalFetch = global.fetch;
  const encoder = new TextEncoder();

  process.env.HERMES_API_SERVER_BASE_URL = "http://hermes.local/v1";
  process.env.HERMES_API_SERVER_KEY = "hermes-secret";

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.match(String(input), /\/responses$/);
    const body = String(init?.body || "");
    assert.match(body, /"stream":true/);

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: response.output_text.delta\ndata: {"delta":"{\\"text\\":\\"你好，先说说你最担心的表现。\\"","type":"response.output_text.delta"}\n\n'
            )
          );
          controller.enqueue(
            encoder.encode(
              'event: response.output_text.delta\ndata: {"delta":",\\"action\\":\\"ask_followup\\",\\"confidence\\":0.91}","type":"response.output_text.delta"}\n\n'
            )
          );
          controller.enqueue(
            encoder.encode('event: response.completed\ndata: {"type":"response.completed"}\n\n')
          );
          controller.close();
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      }
    );
  }) as typeof global.fetch;

  try {
    const deltas: string[] = [];
    const hermes = await import("../lib/realtime/hermes");
    const reply = await hermes.requestHermesAgentTriageReplyStream({
      conversationId: "agent:stream-1",
      prompt: "请帮助我做分诊",
      language: "zh",
      onDelta(delta) {
        deltas.push(delta);
      },
    });

    assert.equal(
      deltas.join(""),
      '{"text":"你好，先说说你最担心的表现。","action":"ask_followup","confidence":0.91}'
    );
    assert.equal(reply.aiResponse.text, "你好，先说说你最担心的表现。");
    assert.equal(reply.aiResponse.action, "ask_followup");
  } finally {
    global.fetch = originalFetch;
    if (previousBaseUrl === undefined) {
      delete process.env.HERMES_API_SERVER_BASE_URL;
    } else {
      process.env.HERMES_API_SERVER_BASE_URL = previousBaseUrl;
    }
    if (previousApiKey === undefined) {
      delete process.env.HERMES_API_SERVER_KEY;
    } else {
      process.env.HERMES_API_SERVER_KEY = previousApiKey;
    }
  }
});
