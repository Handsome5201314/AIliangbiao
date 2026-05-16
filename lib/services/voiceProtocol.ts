import { z } from "zod";

import type { VoiceIntentResult } from "@/lib/schemas/core/types";

export const voiceIntentSchema = z.enum([
  "answer",
  "irrelevant",
  "pause",
  "repeat",
  "previous",
  "change_answer",
  "resume",
  "explain",
  "skip",
  "quit",
  "switch_member",
  "switch_language",
  "slower",
  "faster",
  "risk_escalation",
]);

export const voiceIntentResultSchema = z.object({
  intent: voiceIntentSchema,
  confidence: z.number().min(0).max(1),
  language: z.enum(["zh", "en"]).optional(),
  answer: z
    .object({
      questionId: z.union([z.string(), z.number()]).optional(),
      score: z.number(),
      label: z.string().optional(),
    })
    .optional(),
  changeRequest: z
    .object({
      targetQuestionId: z.union([z.string(), z.number(), z.literal("prev")]).optional(),
      newScore: z.number().nullable().optional(),
    })
    .optional(),
  risk: z
    .object({
      level: z.enum(["low", "medium", "high"]),
      type: z.string(),
      evidence: z.string(),
    })
    .optional(),
  meta: z
    .object({
      reason: z.string().optional(),
      rawTranscript: z.string().optional(),
      normalizedText: z.string().optional(),
      evidence: z.string().optional(),
      needsConfirmation: z.boolean().optional(),
      needsFallbackPrompt: z.boolean().optional(),
    })
    .optional(),
});

export function parseVoiceIntentResponse(raw: unknown): VoiceIntentResult {
  return voiceIntentResultSchema.parse(raw) as VoiceIntentResult;
}

export function isMetaIntent(intent: VoiceIntentResult["intent"]): boolean {
  return intent !== "answer" && intent !== "risk_escalation";
}

export function isAnswerIntent(intent: VoiceIntentResult["intent"]): boolean {
  return intent === "answer";
}

export function isRiskIntent(intent: VoiceIntentResult["intent"]): boolean {
  return intent === "risk_escalation";
}
