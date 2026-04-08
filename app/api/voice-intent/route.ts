import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSystemApiKey } from "@/lib/services/apiKeyService";
import {
  buildScaleRecommendationCopy,
  detectLocalTriageIntent,
  extractSymptomsFromTranscript,
  generateTriagePrompt,
  parseAIResponse,
  recommendScaleFromSymptoms,
  TRIAGE_SYSTEM_PROMPT,
  type TriageAIResponse,
  type TriageContext,
} from "@/lib/services/triageFlow";
import { parseVoiceIntentResponse, voiceIntentResultSchema } from "@/lib/services/voiceProtocol";
import { getScaleDefinitionById } from "@/lib/scales/catalog";
import { resolveLocalizedText } from "@/lib/schemas/core/i18n";
import type { LanguageCode, ScaleOption, ScaleQuestion, VoiceIntentResult } from "@/lib/schemas/core/types";

const questionnaireRequestSchema = z.object({
  mode: z.literal("questionnaire"),
  scaleId: z.string().min(1),
  questionId: z.number(),
  transcript: z.string().min(1),
  language: z.enum(["zh", "en"]).default("zh"),
});

const triageContextSchema = z.object({
  state: z.enum(["initial", "triage", "consent", "handoff", "assessment", "paused"]).default("initial"),
  symptoms: z.array(z.string()).default([]),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.number(),
      })
    )
    .default([]),
  recommendedScale: z.string().optional(),
  consentGiven: z.boolean().default(false),
  language: z.enum(["zh", "en"]).optional(),
  pausedFromState: z.enum(["initial", "triage", "consent", "handoff", "assessment"]).optional(),
  lastAssistantPrompt: z.string().optional(),
  lastIntent: voiceIntentResultSchema.shape.intent.optional(),
  userProfile: z
    .object({
      childName: z.string().optional(),
      childAge: z.number().optional(),
      parentName: z.string().optional(),
      relation: z.string().optional(),
      recentConcerns: z.array(z.string()).optional(),
    })
    .optional(),
});

const triageRequestSchema = z.object({
  mode: z.literal("triage"),
  transcript: z.string().min(1),
  language: z.enum(["zh", "en"]).default("zh"),
  triageContext: triageContextSchema,
  userProfile: z
    .object({
      nickname: z.string().optional(),
      ageMonths: z.number().optional(),
      relation: z.string().optional(),
    })
    .optional(),
});

const requestSchema = z.discriminatedUnion("mode", [questionnaireRequestSchema, triageRequestSchema]);

const META_INTENT_PATTERNS = {
  repeat: [/再说一遍/, /重复/, /repeat/, /say that again/],
  previous: [/上一题/, /上一个/, /退回/, /返回上一题/, /go back/, /previous/],
  explain: [/解释/, /没听懂/, /不明白/, /什么意思/, /explain/, /what does that mean/],
  pause: [/暂停/, /等一下/, /停一下/, /pause/, /hold on/],
  resume: [/继续/, /恢复/, /resume/, /continue/],
};

const RISK_PATTERNS = [
  "不想活",
  "伤害自己",
  "自杀",
  "结束生命",
  "kill myself",
  "hurt myself",
];

function normalizeTranscript(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'，。！？；：“”‘’]/g, " ")
    .replace(/\s+/g, " ");
}

function buildCandidateTexts(option: ScaleOption, index: number, optionCount: number): string[] {
  const baseCandidates = [option.label, ...(option.aliases ?? [])]
    .map(normalizeTranscript)
    .filter(Boolean);

  if (optionCount === 2) {
    if (index === 0) {
      baseCandidates.push("a", "option a", "first", "the first one", "前者", "第一个", "选a", "选a项");
    }
    if (index === 1) {
      baseCandidates.push("b", "option b", "second", "the second one", "后者", "第二个", "选b", "选b项");
    }
  }

  return [...new Set(baseCandidates)];
}

function extractJsonObject(rawContent: string): string {
  const fencedMatch = rawContent.match(/```json\s*([\s\S]*?)```/i) ?? rawContent.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = rawContent.indexOf("{");
  const lastBrace = rawContent.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in model response");
  }

  return rawContent.slice(firstBrace, lastBrace + 1);
}

function buildOpenAICompatiblePayload(model: string, systemPrompt: string, userPrompt: string) {
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 500,
  };
}

function buildQwenPayload(model: string, systemPrompt: string, userPrompt: string) {
  return {
    model,
    input: {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    parameters: {
      temperature: 0.1,
      max_tokens: 500,
    },
  };
}

function extractProviderResponseText(provider: string, data: any): string {
  if (provider === "qwen") {
    return data?.output?.text?.trim?.() || data?.output?.choices?.[0]?.message?.content?.trim?.() || "";
  }

  return data?.choices?.[0]?.message?.content?.trim?.() || "";
}

async function callSystemTextModel<T>(input: {
  systemPrompt: string;
  userPrompt: string;
  parse: (raw: string) => T;
}): Promise<T> {
  const api = await getSystemApiKey();

  const payload =
    api.provider === "qwen"
      ? buildQwenPayload(api.model, input.systemPrompt, input.userPrompt)
      : buildOpenAICompatiblePayload(api.model, input.systemPrompt, input.userPrompt);

  const response = await fetch(api.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.error || `Text model request failed: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = extractProviderResponseText(api.provider, data);
  if (!rawContent) {
    throw new Error("No valid model response content");
  }

  return input.parse(rawContent);
}

function detectQuestionnaireIntent(question: ScaleQuestion, transcript: string): VoiceIntentResult {
  const normalized = normalizeTranscript(transcript);

  for (const metaIntent of Object.entries(META_INTENT_PATTERNS)) {
    if (metaIntent[1].some((pattern) => pattern.test(normalized))) {
      return {
        intent: metaIntent[0] as VoiceIntentResult["intent"],
        confidence: 0.96,
        meta: {
          rawTranscript: transcript,
          normalizedText: normalized,
        },
      };
    }
  }

  if (RISK_PATTERNS.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
    return {
      intent: "risk_escalation",
      confidence: 0.98,
      risk: {
        level: "high",
        type: "self_harm",
        evidence: transcript,
      },
      meta: {
        rawTranscript: transcript,
        normalizedText: normalized,
      },
    };
  }

  if (question.answerMappingHints?.phrases?.length) {
    for (const phrase of question.answerMappingHints.phrases) {
      if (phrase.keywords.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
        const matchedOption = question.options.find((option) => option.score === phrase.score);
        if (matchedOption) {
          return {
            intent: "answer",
            confidence: 0.92,
            answer: {
              questionId: question.id,
              score: matchedOption.score,
              label: matchedOption.label,
            },
            meta: {
              rawTranscript: transcript,
              normalizedText: normalized,
              evidence: phrase.keywords.find((keyword) => normalized.includes(normalizeTranscript(keyword))),
            },
          };
        }
      }
    }
  }

  for (let index = 0; index < question.options.length; index += 1) {
    const option = question.options[index];
    const candidates = buildCandidateTexts(option, index, question.options.length);

    if (candidates.some((candidate) => candidate && normalized.includes(candidate))) {
      return {
        intent: "answer",
        confidence: 0.95,
        answer: {
          questionId: question.id,
          score: option.score,
          label: option.label,
        },
        meta: {
          rawTranscript: transcript,
          normalizedText: normalized,
          evidence: candidates.find((candidate) => candidate && normalized.includes(candidate)),
        },
      };
    }
  }

  if (question.analysisHints?.optionKeywords?.length) {
    for (const optionKeyword of question.analysisHints.optionKeywords) {
      if (optionKeyword.keywords.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
        const matchedOption = question.options.find((option) => option.score === optionKeyword.score);
        if (matchedOption) {
          return {
            intent: "answer",
            confidence: 0.68,
            answer: {
              questionId: question.id,
              score: matchedOption.score,
              label: matchedOption.label,
            },
            meta: {
              rawTranscript: transcript,
              normalizedText: normalized,
              evidence: optionKeyword.keywords.find((keyword) => normalized.includes(normalizeTranscript(keyword))),
              needsConfirmation: true,
            },
          };
        }
      }
    }
  }

  const sortedOptions = [...question.options].sort((left, right) => left.score - right.score);
  const genericMappings = [
    {
      score: sortedOptions[0]?.score,
      patterns: [
        "没有",
        "从不",
        "完全没有",
        "not at all",
        "never",
        "none",
        "no problem",
      ],
    },
    {
      score: sortedOptions[1]?.score ?? sortedOptions[0]?.score,
      patterns: [
        "偶尔",
        "有时",
        "几天",
        "a few days",
        "several days",
        "sometimes",
        "once in a while",
      ],
    },
    {
      score: sortedOptions[Math.max(0, sortedOptions.length - 2)]?.score,
      patterns: [
        "经常",
        "不少",
        "一半以上",
        "more than half the days",
        "half the days",
        "about half the days",
        "often",
        "frequently",
        "most weeks",
      ],
    },
    {
      score: sortedOptions[sortedOptions.length - 1]?.score,
      patterns: [
        "总是",
        "每天",
        "几乎每天",
        "every day",
        "nearly every day",
        "almost every day",
        "most days",
        "all the time",
        "constantly",
      ],
    },
  ];

  for (const mapping of genericMappings) {
    if (
      mapping.score !== undefined &&
      mapping.patterns.some((pattern) => normalized.includes(normalizeTranscript(pattern)))
    ) {
      const matchedOption = question.options.find((option) => option.score === mapping.score);
      if (matchedOption) {
        return {
          intent: "answer",
          confidence: 0.72,
          answer: {
            questionId: question.id,
            score: matchedOption.score,
            label: matchedOption.label,
          },
          meta: {
            rawTranscript: transcript,
            normalizedText: normalized,
            evidence: mapping.patterns.find((pattern) => normalized.includes(normalizeTranscript(pattern))),
            needsConfirmation: true,
          },
        };
      }
    }
  }

  return {
    intent: "irrelevant",
    confidence: 0.32,
    meta: {
      rawTranscript: transcript,
      normalizedText: normalized,
      needsFallbackPrompt: true,
    },
  };
}

function buildQuestionnaireIntentPrompt(question: ScaleQuestion, transcript: string, language: LanguageCode): string {
  const compactQuestion = {
    id: question.id,
    text: resolveLocalizedText(question.text, language),
    colloquial: resolveLocalizedText(question.colloquial, language),
    options: question.options.map((option) => ({
      label: option.label,
      score: option.score,
      aliases: option.aliases ?? [],
    })),
  };

  return JSON.stringify({
    task: "Map one spoken answer to a questionnaire intent.",
    outputSchema: {
      intent:
        "answer | irrelevant | pause | repeat | previous | change_answer | resume | explain | skip | quit | switch_member | switch_language | slower | faster | risk_escalation",
      confidence: "0-1",
      answer: {
        questionId: "number",
        score: "number",
        label: "string",
      },
      risk: {
        level: "low | medium | high",
        type: "string",
        evidence: "string",
      },
      meta: {
        reason: "string",
        rawTranscript: "string",
        normalizedText: "string",
        evidence: "string",
        needsConfirmation: "boolean",
        needsFallbackPrompt: "boolean",
      },
    },
    rules: [
      "Return JSON only.",
      "Only use one of the allowed option scores.",
      "If the user is asking to repeat, explain, go previous, pause, or resume, return that meta intent instead of answer.",
      "If the content suggests self-harm or severe danger, return risk_escalation.",
      "If no option can be inferred, return irrelevant.",
      "Keep confidence conservative.",
    ],
    question: compactQuestion,
    transcript,
  });
}

async function resolveQuestionnaireIntent(input: z.infer<typeof questionnaireRequestSchema>) {
  const scale = getScaleDefinitionById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  const question = scale.questions.find((item) => item.id === input.questionId);
  if (!question) {
    throw new Error(`Question ${input.questionId} not found`);
  }

  const localResult = detectQuestionnaireIntent(question, input.transcript);
  if (localResult.intent !== "irrelevant" && localResult.confidence >= 0.55) {
    return { result: localResult, source: "rule" as const };
  }

  try {
    const llmResult = await callSystemTextModel({
      systemPrompt:
        "You are a structured questionnaire voice-intent parser. Only return JSON. Never add extra explanation.",
      userPrompt: buildQuestionnaireIntentPrompt(question, input.transcript, input.language),
      parse: (raw) => parseVoiceIntentResponse(JSON.parse(extractJsonObject(raw))),
    });
    return { result: llmResult, source: "llm" as const };
  } catch {
    return { result: localResult, source: "rule" as const };
  }
}

async function resolveTriageIntent(input: z.infer<typeof triageRequestSchema>) {
  const nextSymptoms = extractSymptomsFromTranscript(input.transcript, input.triageContext.symptoms);
  const contextForAI: TriageContext = {
    ...input.triageContext,
    symptoms: nextSymptoms,
    language: input.language,
    conversationHistory: [
      ...input.triageContext.conversationHistory,
      { role: "user", content: input.transcript, timestamp: Date.now() },
    ],
  };

  const localIntent = detectLocalTriageIntent(input.transcript, contextForAI, input.language);
  if (localIntent) {
    const enrichedLocal: TriageAIResponse = {
      ...localIntent,
      symptoms: localIntent.symptoms?.length ? localIntent.symptoms : nextSymptoms,
    };
    return { result: enrichedLocal, source: "rule" as const };
  }

  try {
    const llmResult = await callSystemTextModel({
      systemPrompt: TRIAGE_SYSTEM_PROMPT,
      userPrompt: generateTriagePrompt(input.transcript, contextForAI, input.userProfile),
      parse: (raw) => parseAIResponse(raw),
    });

    const patchedResult =
      llmResult.action === "acknowledge" && !llmResult.scaleId && nextSymptoms.length >= 2
        ? {
            ...llmResult,
            action: "recommend_scale" as const,
            scaleId: recommendScaleFromSymptoms(nextSymptoms, input.transcript) || "SRS",
            text: llmResult.text || buildScaleRecommendationCopy(recommendScaleFromSymptoms(nextSymptoms, input.transcript) || "SRS", input.language),
            symptoms: nextSymptoms,
          }
        : {
            ...llmResult,
            symptoms: llmResult.symptoms?.length ? llmResult.symptoms : nextSymptoms,
          };

    return { result: patchedResult, source: "llm" as const };
  } catch {
    const fallbackRecommendation = recommendScaleFromSymptoms(nextSymptoms, input.transcript);
    const fallbackResult: TriageAIResponse = {
      text: fallbackRecommendation
        ? buildScaleRecommendationCopy(fallbackRecommendation, input.language)
        : input.language === "en"
          ? "Please tell me the main symptom or concern you want to evaluate."
          : "请直接告诉我，最想评估的主要症状或困扰是什么。",
      action: fallbackRecommendation ? "recommend_scale" : "ask_followup",
      scaleId: fallbackRecommendation,
      confidence: fallbackRecommendation ? 0.75 : 0.5,
      symptoms: nextSymptoms,
      meta: {
        reason: "fallback after triage model failure",
      },
    };
    return { result: fallbackResult, source: "rule" as const };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());

    if (body.mode === "questionnaire") {
      const resolved = await resolveQuestionnaireIntent(body);
      return NextResponse.json({
        mode: "questionnaire",
        source: resolved.source,
        result: resolved.result,
      });
    }

    const resolved = await resolveTriageIntent(body);
    return NextResponse.json({
      mode: "triage",
      source: resolved.source,
      result: resolved.result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve voice intent" },
      { status: 500 }
    );
  }
}
