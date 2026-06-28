import crypto from 'node:crypto';

import type { Prisma } from '@prisma/client';

import type { AgentSessionPayload } from '@/lib/assessment-skill/auth';
import type {
  confirmMappedScaleAnswer,
  mapNaturalLanguageScaleAnswer,
} from '@/lib/assessment-skill/scale-service';
import { prisma } from '@/lib/db/prisma';

type AnswerMappingResult = ReturnType<typeof mapNaturalLanguageScaleAnswer>;
type ConfirmMappedAnswerResult = ReturnType<typeof confirmMappedScaleAnswer>;
type ConversationAuditMessage = {
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
};
type ConversationAnalysisAuditResult = {
  coverage?: {
    answered?: number;
    total?: number;
    ratio?: number;
  };
  llmUsed?: boolean;
  answers?: Array<number | null>;
  suggestions?: Array<{
    questionId?: number;
    score?: number | null;
    confidence?: number;
    method?: string;
    needsConfirmation?: boolean;
    requiresExplicitSelection?: boolean;
  }>;
};

function hashAiDecisionText(value?: string | null) {
  const text = value?.trim();
  if (!text) {
    return null;
  }

  return crypto.createHash('sha256').update(text).digest('hex');
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function summarizeSession(session: AgentSessionPayload) {
  return {
    channel: session.channel,
    tenantRole: session.tenant_role,
    entrypoint: session.entrypoint,
    agentSessionId: session.session_id,
  };
}

function summarizeConversationMessages(messages: ConversationAuditMessage[]) {
  const items = messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof message.content === 'string' ? message.content : '';

      return {
        role,
        contentHash: hashAiDecisionText(content),
        contentLength: content.length,
      };
    })
    .filter((item) => item.contentLength > 0);
  const messagesHash = hashAiDecisionText(
    items.map((item) => `${item.role}:${item.contentHash}:${item.contentLength}`).join('|')
  );

  return {
    messagesHash,
    messageCount: items.length,
    userMessageCount: items.filter((item) => item.role === 'user').length,
    assistantMessageCount: items.filter((item) => item.role === 'assistant').length,
    totalContentLength: items.reduce((total, item) => total + item.contentLength, 0),
  };
}

function buildSessionRelationData(session: AgentSessionPayload) {
  return {
    userId: session.sub || null,
    memberProfileId: session.member_id || null,
    doctorProfileId: session.doctor_profile_id || null,
    assessmentSessionId: null,
  };
}

export async function recordAnswerMappingDecision(input: {
  session: AgentSessionPayload;
  scaleId: string;
  questionId: number;
  text: string;
  language?: 'zh' | 'en';
  result: AnswerMappingResult;
  source?: 'skill_map_answer';
}) {
  const textHash = hashAiDecisionText(input.text);
  const mapping = input.result.mapping;

  await prisma.aiDecisionLog.create({
    data: {
      ...buildSessionRelationData(input.session),
      decisionType: 'ANSWER_MAPPING',
      modelName: 'deterministic-answer-mapper',
      promptHash: textHash,
      inputSummary: JSON.stringify({
        scaleId: input.scaleId,
        questionId: input.questionId,
        language: input.language || 'zh',
        textHash,
        textLength: input.text.length,
      }),
      outputSummary: JSON.stringify({
        scaleId: input.result.scaleId,
        questionId: mapping.questionId,
        score: mapping.score,
        confidence: mapping.confidence,
        method: mapping.method,
        needsConfirmation: input.result.needsConfirmation,
        requiresExplicitSelection: input.result.requiresExplicitSelection,
      }),
      confidence: mapping.confidence,
      reviewRequired: input.result.needsConfirmation || input.result.requiresExplicitSelection,
      metadata: toInputJson({
        source: input.source || 'skill_map_answer',
        scaleId: input.result.scaleId,
        scaleVersion: input.result.scaleVersion,
        questionId: mapping.questionId,
        score: mapping.score,
        method: mapping.method,
        textHash,
        textLength: input.text.length,
        ...summarizeSession(input.session),
      }),
    },
  });
}

export async function recordConversationAnalysisDecision(input: {
  session: AgentSessionPayload;
  scaleId: string;
  messages: ConversationAuditMessage[];
  result: ConversationAnalysisAuditResult;
  source?: 'skill_conversation_analysis';
}) {
  const messageSummary = summarizeConversationMessages(input.messages);
  const suggestions = Array.isArray(input.result.suggestions) ? input.result.suggestions : [];
  const mappedSuggestions = suggestions.filter((suggestion) => suggestion.score !== null && suggestion.score !== undefined);
  const confirmationCount = suggestions.filter((suggestion) => suggestion.needsConfirmation === true).length;
  const explicitSelectionCount = suggestions.filter((suggestion) => suggestion.requiresExplicitSelection === true).length;
  const confidenceValues = mappedSuggestions
    .map((suggestion) => suggestion.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : null;

  await prisma.aiDecisionLog.create({
    data: {
      ...buildSessionRelationData(input.session),
      decisionType: 'ANSWER_MAPPING',
      modelName: input.result.llmUsed
        ? 'system-text-api-conversation-mapper'
        : 'heuristic-conversation-mapper',
      promptHash: messageSummary.messagesHash,
      inputSummary: JSON.stringify({
        scaleId: input.scaleId,
        ...messageSummary,
      }),
      outputSummary: JSON.stringify({
        scaleId: input.scaleId,
        coverage: input.result.coverage || null,
        llmUsed: input.result.llmUsed === true,
        answerCount: Array.isArray(input.result.answers) ? input.result.answers.length : 0,
        suggestionCount: suggestions.length,
        mappedSuggestionCount: mappedSuggestions.length,
        confirmationCount,
        explicitSelectionCount,
      }),
      confidence: averageConfidence,
      fallbackReason: input.result.llmUsed ? null : 'heuristic_only',
      reviewRequired: confirmationCount > 0 || explicitSelectionCount > 0,
      metadata: toInputJson({
        source: input.source || 'skill_conversation_analysis',
        scaleId: input.scaleId,
        llmUsed: input.result.llmUsed === true,
        suggestionCount: suggestions.length,
        mappedSuggestionCount: mappedSuggestions.length,
        confirmationCount,
        explicitSelectionCount,
        messagesHash: messageSummary.messagesHash,
        messageCount: messageSummary.messageCount,
        ...summarizeSession(input.session),
      }),
    },
  });
}

export async function recordLowConfidenceConfirmationDecision(input: {
  session: AgentSessionPayload;
  scaleId: string;
  questionId: number;
  score: number;
  confidence?: number;
  evidence?: string;
  result: ConfirmMappedAnswerResult;
  source?: 'skill_confirm_mapped_answer';
}) {
  const evidenceHash = hashAiDecisionText(input.evidence);
  const confirmedAnswer = input.result.confirmedAnswer;

  await prisma.aiDecisionLog.create({
    data: {
      ...buildSessionRelationData(input.session),
      decisionType: 'LOW_CONFIDENCE_CONFIRMATION',
      modelName: 'human-confirmed-answer-mapping',
      promptHash: evidenceHash,
      inputSummary: JSON.stringify({
        scaleId: input.scaleId,
        questionId: input.questionId,
        score: input.score,
        confidence: input.confidence ?? null,
        evidenceHash,
        evidenceLength: input.evidence?.length ?? 0,
      }),
      outputSummary: JSON.stringify({
        scaleId: input.result.scaleId,
        questionId: confirmedAnswer.questionId,
        score: confirmedAnswer.score,
        confidence: confirmedAnswer.confidence,
        source: confirmedAnswer.source,
        reviewRequired: confirmedAnswer.reviewRequired,
      }),
      confidence: confirmedAnswer.confidence,
      reviewRequired: confirmedAnswer.reviewRequired,
      metadata: toInputJson({
        source: input.source || 'skill_confirm_mapped_answer',
        scaleId: input.result.scaleId,
        scaleVersion: input.result.scaleVersion,
        questionId: confirmedAnswer.questionId,
        score: confirmedAnswer.score,
        evidenceHash,
        evidenceLength: input.evidence?.length ?? 0,
        ...summarizeSession(input.session),
      }),
    },
  });
}
