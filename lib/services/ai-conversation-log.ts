import crypto from "node:crypto";

import { prisma } from "@/lib/db/prisma";

export const AI_CONVERSATION_CONFIG_VERSION = "parent-voice-ai-control-phase1";

export type AiConversationEventType =
  | "audio_uploaded"
  | "asr_result"
  | "user_utterance"
  | "assistant_prompt"
  | "answer_mapping_local"
  | "answer_mapping_ai"
  | "answer_confirmation"
  | "tool_call"
  | "tts_output"
  | "fallback"
  | "error"
  | "assessment_answer_committed";

export type AiConversationContext = {
  conversationSessionId?: string | null;
  userId?: string | null;
  memberProfileId?: string | null;
  assessmentSessionId?: string | null;
  assessmentHistoryId?: string | null;
  doctorProfileId?: string | null;
  scaleId?: string | null;
  questionId?: number | null;
};

type RawRecord = Record<string, unknown>;

type AiConversationDb = {
  aiConversationSession: {
    create(args: { data: RawRecord }): Promise<RawRecord>;
    upsert(args: { where: { id: string }; update: RawRecord; create: RawRecord }): Promise<RawRecord>;
    update(args: { where: { id: string }; data: RawRecord }): Promise<RawRecord>;
    findUnique(args: { where: { id: string }; include?: RawRecord }): Promise<RawRecord | null>;
    findMany(args: RawRecord): Promise<RawRecord[]>;
  };
  aiConversationEvent: {
    create(args: { data: RawRecord }): Promise<RawRecord>;
    findMany(args: RawRecord): Promise<RawRecord[]>;
  };
};

function db(): AiConversationDb {
  return prisma as unknown as AiConversationDb;
}

function cleanData(data: RawRecord): RawRecord {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== ""));
}

function stringOrUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createPromptHash(prompt: string) {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

export async function ensureAiConversationSession(input: AiConversationContext & {
  source?: string;
  status?: string;
  provider?: string | null;
  model?: string | null;
  promptHash?: string | null;
  configVersion?: string | null;
  metadata?: unknown;
  completedAt?: Date | null;
}) {
  const id = stringOrUndefined(input.conversationSessionId);
  const now = new Date();
  const baseData = cleanData({
    userId: stringOrUndefined(input.userId),
    memberProfileId: stringOrUndefined(input.memberProfileId),
    assessmentSessionId: stringOrUndefined(input.assessmentSessionId),
    assessmentHistoryId: stringOrUndefined(input.assessmentHistoryId),
    doctorProfileId: stringOrUndefined(input.doctorProfileId),
    scaleId: stringOrUndefined(input.scaleId),
    questionId: numberOrUndefined(input.questionId),
    source: input.source || "parent_voice",
    status: input.status || "ACTIVE",
    provider: stringOrUndefined(input.provider),
    model: stringOrUndefined(input.model),
    promptHash: stringOrUndefined(input.promptHash),
    configVersion: stringOrUndefined(input.configVersion) || AI_CONVERSATION_CONFIG_VERSION,
    metadata: input.metadata,
    completedAt: input.completedAt || undefined,
  });

  if (!id) {
    return db().aiConversationSession.create({
      data: cleanData({
        ...baseData,
        updatedAt: now,
      }),
    });
  }

  return db().aiConversationSession.upsert({
    where: { id },
    update: cleanData({
      ...baseData,
      updatedAt: now,
    }),
    create: cleanData({
      id,
      ...baseData,
      updatedAt: now,
    }),
  });
}

export async function recordAiConversationEvent(input: AiConversationContext & {
  eventType: AiConversationEventType;
  source?: string;
  status?: string;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  confirmedLowConfidence?: boolean;
  promptHash?: string | null;
  configVersion?: string | null;
  transcriptText?: string | null;
  assistantText?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  fallbackReason?: string | null;
  metadata?: unknown;
}) {
  const session = await ensureAiConversationSession(input);
  const sessionId = String(session.id);

  const event = await db().aiConversationEvent.create({
    data: cleanData({
      sessionId,
      userId: stringOrUndefined(input.userId) || stringOrUndefined(session.userId as string | null),
      memberProfileId:
        stringOrUndefined(input.memberProfileId) || stringOrUndefined(session.memberProfileId as string | null),
      assessmentSessionId:
        stringOrUndefined(input.assessmentSessionId) ||
        stringOrUndefined(session.assessmentSessionId as string | null),
      assessmentHistoryId:
        stringOrUndefined(input.assessmentHistoryId) ||
        stringOrUndefined(session.assessmentHistoryId as string | null),
      doctorProfileId:
        stringOrUndefined(input.doctorProfileId) || stringOrUndefined(session.doctorProfileId as string | null),
      eventType: input.eventType,
      scaleId: stringOrUndefined(input.scaleId) || stringOrUndefined(session.scaleId as string | null),
      questionId: numberOrUndefined(input.questionId) || numberOrUndefined(session.questionId as number | null),
      provider: stringOrUndefined(input.provider),
      model: stringOrUndefined(input.model),
      confidence: numberOrUndefined(input.confidence),
      confirmedLowConfidence: Boolean(input.confirmedLowConfidence),
      promptHash: stringOrUndefined(input.promptHash),
      configVersion: stringOrUndefined(input.configVersion) || AI_CONVERSATION_CONFIG_VERSION,
      transcriptText: stringOrUndefined(input.transcriptText),
      assistantText: stringOrUndefined(input.assistantText),
      summary: stringOrUndefined(input.summary),
      errorMessage: stringOrUndefined(input.errorMessage),
      fallbackReason: stringOrUndefined(input.fallbackReason),
      metadata: input.metadata,
    }),
  });

  if (input.eventType === "assessment_answer_committed") {
    await db().aiConversationSession.update({
      where: { id: sessionId },
      data: cleanData({
        status: input.status || "ANSWER_COMMITTED",
        updatedAt: new Date(),
      }),
    });
  }

  return {
    session: {
      ...session,
      id: sessionId,
    },
    event,
  };
}
