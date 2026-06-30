import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  API_SERVICE_TYPES,
  normalizeApiServiceType,
  PROVIDER_CONFIGS,
} from "../lib/services/apiKeyProviderConfig";
import {
  buildHermesMappingFallbackIntent,
  resolveLocalQuestionnaireVoiceIntent,
  shouldEscalateToHermes,
} from "../lib/services/voice-answer-mapping";
import type { ScaleQuestion } from "../lib/schemas/core/types";

function binaryQuestion(): ScaleQuestion {
  return {
    id: 1,
    text: "孩子会回应自己的名字吗？",
    clinical_intent: "binary response test",
    colloquial: "叫孩子名字时，孩子会不会回头或回应？",
    fallback_examples: [],
    options: [
      {
        label: "是",
        score: 0,
        aliases: ["会", "有", "可以", "yes"],
      },
      {
        label: "否",
        score: 1,
        aliases: ["不是", "不会", "没有", "no"],
      },
    ],
  };
}

test("AI service types normalize legacy speech into long-term asr semantics", () => {
  assert.deepEqual(API_SERVICE_TYPES, ["text", "asr", "tts"]);
  assert.equal(normalizeApiServiceType("text"), "text");
  assert.equal(normalizeApiServiceType("asr"), "asr");
  assert.equal(normalizeApiServiceType("tts"), "tts");
  assert.equal(normalizeApiServiceType("speech"), "asr");
  assert.equal(normalizeApiServiceType(""), "text");
  assert.equal(PROVIDER_CONFIGS.siliconflow.asrModel, "FunAudioLLM/SenseVoiceSmall");
  assert.equal(Boolean(PROVIDER_CONFIGS.volcengine.ttsEndpoint), true);
});

test("clear binary parent utterances map locally with high confidence", () => {
  const question = binaryQuestion();
  const affirmative = resolveLocalQuestionnaireVoiceIntent({
    question,
    transcript: "是，会回应",
    language: "zh",
  });
  const negative = resolveLocalQuestionnaireVoiceIntent({
    question,
    transcript: "不会，没有回应",
    language: "zh",
  });

  assert.equal(affirmative.intent, "answer");
  assert.equal(affirmative.answer?.score, 0);
  assert.ok(affirmative.confidence >= 0.8);
  assert.equal(affirmative.meta?.needsConfirmation, undefined);

  assert.equal(negative.intent, "answer");
  assert.equal(negative.answer?.score, 1);
  assert.ok(negative.confidence >= 0.8);
});

test("uncertain parent utterances must escalate instead of committing locally", () => {
  const question = binaryQuestion();
  for (const transcript of ["不清楚", "三天转两回吧", "偶尔会一点", "可能有吧", "说不好"]) {
    const result = resolveLocalQuestionnaireVoiceIntent({ question, transcript, language: "zh" });
    assert.notEqual(result.intent, "answer", `${transcript} must not be committed directly`);
    assert.equal(result.meta?.needsFallbackPrompt, true);
    assert.equal(shouldEscalateToHermes(result), true);
  }
});

test("Hermes failure fallback asks for confirmation or follow-up instead of fake success", () => {
  const fallback = buildHermesMappingFallbackIntent({
    transcript: "偶尔会一点",
    language: "zh",
    reason: "Hermes timeout",
  });

  assert.equal(fallback.intent, "irrelevant");
  assert.equal(fallback.meta?.needsFallbackPrompt, true);
  assert.match(fallback.meta?.followUpQuestion || "", /再具体|确认|请选择/);
  assert.match(fallback.meta?.reason || "", /Hermes timeout/);
});

test("Prisma schema defines project-owned AI conversation session and event logs", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");

  assert.match(schema, /model\s+AiConversationSession\s+{/);
  assert.match(schema, /model\s+AiConversationEvent\s+{/);
  assert.match(schema, /hermesConversationId\s+String\?/);
  assert.match(schema, /confirmedLowConfidence\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /@@map\("ai_conversation_session"\)/);
  assert.match(schema, /@@map\("ai_conversation_event"\)/);
});

test("local migration creates AI conversation logs and migrates speech serviceType to asr", async () => {
  const migration = await readFile(
    "prisma/migrations/20260630_parent_voice_ai_control_phase1/migration.sql",
    "utf8"
  );

  assert.match(migration, /CREATE TABLE "ai_conversation_session"/);
  assert.match(migration, /CREATE TABLE "ai_conversation_event"/);
  assert.match(migration, /UPDATE "ApiKey"\s+SET "serviceType" = 'asr'\s+WHERE "serviceType" = 'speech'/);
  assert.match(migration, /CHECK \("serviceType" IN \('text', 'asr', 'tts'\)\)/);
});

test("voice routes record ASR, mapping, confirmation, fallback, and commit events", async () => {
  const speechRoute = await readFile("app/api/speech/transcribe/route.ts", "utf8");
  const voiceIntentRoute = await readFile("app/api/voice-intent/route.ts", "utf8");
  const voiceEventsRoute = await readFile("app/api/skill/v1/voice-events/route.ts", "utf8");
  const hook = await readFile("lib/services/useVoiceSession.ts", "utf8");

  assert.match(speechRoute, /recordAiConversationEvent/);
  assert.match(speechRoute, /audio_uploaded/);
  assert.match(speechRoute, /asr_result/);
  assert.match(speechRoute, /error/);

  assert.match(voiceIntentRoute, /requestHermesQuestionnaireAnswerMapping/);
  assert.match(voiceIntentRoute, /answer_mapping_local/);
  assert.match(voiceIntentRoute, /answer_mapping_hermes/);
  assert.match(voiceIntentRoute, /fallback/);

  assert.match(voiceEventsRoute, /answer_confirmation/);
  assert.match(voiceEventsRoute, /assessment_answer_committed/);
  assert.match(hook, /\/api\/skill\/v1\/voice-events/);
  assert.match(hook, /conversationSessionIdRef/);
});

test("mobile H5 parent voice answering uses ASR, voice intent mapping, confirmation, and commit logging", async () => {
  const h5Service = await readFile("components/mobile-h5/services/assessmentService.ts", "utf8");
  const h5Runner = await readFile("components/mobile-h5/screens/shared/AssessmentRunner.tsx", "utf8");

  assert.match(h5Service, /transcribeVoiceAnswer/);
  assert.match(h5Service, /\/api\/skill\/v1\/speech\/transcribe/);
  assert.match(h5Service, /\/api\/skill\/v1\/voice-intent/);
  assert.match(h5Service, /recordVoiceAnswerEvent/);
  assert.match(h5Service, /\/api\/skill\/v1\/voice-events/);
  assert.doesNotMatch(h5Service, /\/api\/skill\/v1\/scales\/\$\{encodeURIComponent\(params\.scaleId\)\}\/map-answer/);

  assert.match(h5Runner, /canUseParentVoice/);
  assert.match(h5Runner, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(h5Runner, /new MediaRecorder/);
  assert.match(h5Runner, /handleVoiceAnswerToggle/);
  assert.match(h5Runner, /录音会先转写，再进入 AI\/Hermes 辅助映射/);
  assert.match(h5Runner, /eventType: 'answer_confirmation'/);
  assert.match(h5Runner, /eventType: 'assessment_answer_committed'/);
});

test("admin AI control plane is super-admin only and exposes debug console links safely", async () => {
  const layout = await readFile("app/admin/layout.tsx", "utf8");
  const agentRoute = await readFile("app/api/admin/agent/config/route.ts", "utf8");
  const apiKeysRoute = await readFile("app/api/admin/apikeys/route.ts", "utf8");
  const agentPage = await readFile("app/admin/agent/page.tsx", "utf8");

  assert.match(layout, /href: '\/admin\/ai-logs'/);
  assert.match(layout, /name: 'AI 会话日志'/);
  assert.match(layout, /href: '\/admin\/agent'[\s\S]*?roles: \[ADMIN_ROLE\.SUPER_ADMIN\]/);
  assert.match(layout, /href: '\/admin\/apikeys'[\s\S]*?roles: \[ADMIN_ROLE\.SUPER_ADMIN\]/);

  assert.match(agentRoute, /roles: \[ADMIN_ROLE\.SUPER_ADMIN\]/);
  assert.match(apiKeysRoute, /roles: \[ADMIN_ROLE\.SUPER_ADMIN\]/);
  assert.match(agentPage, /OpenWebUI 只用于工程调试/);
  assert.match(agentPage, /target="_blank"/);
  assert.match(agentPage, /consoleLinks\.openWebuiUrl/);
  assert.match(agentPage, /consoleLinks\.hermesUrl/);
});

test("admin AI logs and research export use project database with deidentification", async () => {
  const listRoute = await readFile("app/api/admin/ai-conversations/route.ts", "utf8");
  const detailRoute = await readFile("app/api/admin/ai-conversations/[id]/route.ts", "utf8");
  const page = await readFile("app/admin/ai-logs/page.tsx", "utf8");
  const exportSource = await readFile("lib/services/research-export.ts", "utf8");

  assert.match(listRoute, /ADMIN_ROLE\.SUPER_ADMIN/);
  assert.match(listRoute, /aiConversationSession/);
  assert.match(listRoute, /confirmedLowConfidence/);
  assert.match(detailRoute, /aiConversationEvent/);
  assert.match(page, /\/api\/admin\/ai-conversations/);
  assert.match(page, /低置信度/);
  assert.match(page, /最终答案写入轨迹/);

  assert.match(exportSource, /ai_conversation_session/);
  assert.match(exportSource, /ai_conversation_event/);
  assert.match(exportSource, /confirmed_answer_only/);
  assert.doesNotMatch(exportSource, /openwebui/i);
});
