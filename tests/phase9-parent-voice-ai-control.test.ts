import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  API_SERVICE_TYPES,
  normalizeApiServiceType,
  PROVIDER_CONFIGS,
} from "../lib/services/apiKeyProviderConfig";
import {
  buildClarificationIntent,
  needsClarification,
  resolveLocalQuestionnaireVoiceIntent,
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
      { label: "是", score: 0, aliases: ["会", "有", "可以", "yes"] },
      { label: "否", score: 1, aliases: ["不是", "不会", "没有", "no"] },
    ],
  };
}

test("AI service types stay generic for text, ASR, and TTS providers", () => {
  assert.deepEqual(API_SERVICE_TYPES, ["text", "asr", "tts"]);
  assert.equal(normalizeApiServiceType("speech"), "asr");
  assert.equal(PROVIDER_CONFIGS.siliconflow.asrModel, "FunAudioLLM/SenseVoiceSmall");
  assert.equal(Boolean(PROVIDER_CONFIGS.volcengine.ttsEndpoint), true);
});

test("clear parent utterances map locally and uncertain answers require clarification", () => {
  const question = binaryQuestion();
  const affirmative = resolveLocalQuestionnaireVoiceIntent({ question, transcript: "是，会回应", language: "zh" });
  assert.equal(affirmative.intent, "answer");
  assert.equal(affirmative.answer?.score, 0);
  assert.ok(affirmative.confidence >= 0.8);
  assert.equal(needsClarification(affirmative), false);

  for (const transcript of ["不清楚", "三天转两回吧", "偶尔会一点", "可能有吧", "说不好"]) {
    const result = resolveLocalQuestionnaireVoiceIntent({ question, transcript, language: "zh" });
    assert.notEqual(result.intent, "answer", `${transcript} must not be committed directly`);
    assert.equal(result.meta?.needsFallbackPrompt, true);
    assert.equal(needsClarification(result), true);
  }
});

test("clarification fallback asks for confirmation without external runtime dependency", () => {
  const fallback = buildClarificationIntent({
    transcript: "偶尔会一点",
    language: "zh",
    reason: "Local answer mapping needs confirmation",
  });

  assert.equal(fallback.intent, "irrelevant");
  assert.equal(fallback.meta?.needsFallbackPrompt, true);
  assert.match(fallback.meta?.followUpQuestion || "", /再具体|确认|请选择/);
  assert.match(fallback.meta?.reason || "", /Local answer mapping/);
});

test("AI conversation logs are project-owned and do not store runtime-specific conversation IDs", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile(
    "prisma/migrations/20260702_remove_hermes_neonate_growth/migration.sql",
    "utf8"
  );

  assert.match(schema, /model\s+AiConversationSession\s+{/);
  assert.match(schema, /model\s+AiConversationEvent\s+{/);
  assert.doesNotMatch(schema, /hermesConversationId/);
  assert.match(schema, /confirmedLowConfidence\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /DROP COLUMN IF EXISTS "hermesConversationId"/);
});

test("voice routes record ASR and confirmation events without embedded Hermes mapping", async () => {
  const speechRoute = await readFile("app/api/speech/transcribe/route.ts", "utf8");
  const voiceIntentRoute = await readFile("app/api/voice-intent/route.ts", "utf8");
  const voiceEventsRoute = await readFile("app/api/skill/v1/voice-events/route.ts", "utf8");

  assert.match(speechRoute, /recordAiConversationEvent/);
  assert.match(speechRoute, /audio_uploaded/);
  assert.match(speechRoute, /asr_result/);
  assert.match(voiceIntentRoute, /answer_mapping_local/);
  assert.match(voiceIntentRoute, /local_mapping_needs_confirmation/);
  assert.doesNotMatch(voiceIntentRoute, /requestHermes|answer_mapping_hermes|hermes_runtime/i);
  assert.match(voiceEventsRoute, /answer_confirmation/);
  assert.match(voiceEventsRoute, /assessment_answer_committed/);
});

test("mobile H5 keeps pure one-question answering and AI only opens explanations", async () => {
  const runner = await readFile("components/mobile-h5/screens/shared/AssessmentRunner.tsx", "utf8");

  assert.match(runner, /data-component="assessment-runner"/);
  assert.match(runner, /currentQuestion/);
  assert.match(runner, /onOpenAi\(currentQuestion,\s*currentIndex \+ 1\)/);
  assert.match(runner, /提交中/);
  assert.doesNotMatch(runner, /MediaRecorder|mapNaturalLanguageAnswer|confirmMappedAnswer|ai-answer-mapping-panel/);
});

test("admin AI control plane keeps provider config and generic debug links", async () => {
  const layout = await readFile("app/admin/layout.tsx", "utf8");
  const agentPage = await readFile("app/admin/agent/page.tsx", "utf8");
  const apiKeysPage = await readFile("app/admin/apikeys/page.tsx", "utf8");

  assert.match(layout, /href: '\/admin\/ai-logs'/);
  assert.match(layout, /href: '\/admin\/agent'[\s\S]*?roles: \[ADMIN_ROLE\.SUPER_ADMIN\]/);
  assert.match(layout, /href: '\/admin\/apikeys'[\s\S]*?roles: \[ADMIN_ROLE\.SUPER_ADMIN\]/);
  assert.match(agentPage, /knowledgeConsoleUrl/);
  assert.match(agentPage, /外部 AI \/ 知识库调试入口/);
  assert.match(apiKeysPage, /text \/ asr \/ tts/);
});
