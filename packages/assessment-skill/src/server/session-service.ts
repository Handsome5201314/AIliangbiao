import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import {
  evaluateScaleAnswers,
  getSerializableScaleById,
  normalizeScaleFormData,
} from '@/lib/scales/catalog';
import type {
  ScaleDefinition,
  ScaleQuestion,
  ScaleScoreResult,
} from '@/lib/schemas/core/types';

export type AssessmentSessionStatus = 'draft' | 'collecting_form' | 'questioning' | 'completed' | 'cancelled';
export type AssessmentSessionChannel = 'web' | 'voice' | 'agent' | 'mcp';

type SessionConversationState = {
  quotaDeviceId?: string | null;
  result?: ScaleScoreResult;
  assessmentId?: string;
  evidence?: Array<Record<string, unknown>>;
};

export interface AssessmentSessionState {
  sessionId: string;
  userId: string;
  profileId?: string | null;
  scaleId: string;
  status: AssessmentSessionStatus;
  channel: AssessmentSessionChannel;
  currentQuestionIndex: number | null;
  questionCount: number;
  answeredCount: number;
  answers: Array<number | null>;
  formData?: Record<string, string | number | null>;
  currentQuestion?: ScaleQuestion;
  result?: ScaleScoreResult;
  assessmentId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

function getScaleOrThrow(scaleId: string): ScaleDefinition {
  const scale = getSerializableScaleById(scaleId);
  if (!scale) {
    throw new Error(`Scale ${scaleId} not found`);
  }

  return scale;
}

function normalizeSessionAnswers(rawAnswers: unknown, questionCount: number): Array<number | null> {
  const source = Array.isArray(rawAnswers) ? rawAnswers : [];
  const answers = Array.from({ length: questionCount }, (_, index) => source[index]);
  return answers.map((answer) => (typeof answer === 'number' ? answer : null));
}

function normalizeConversationState(rawState: unknown): SessionConversationState {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return {};
  }

  return rawState as SessionConversationState;
}

function countAnswered(answers: Array<number | null>) {
  return answers.filter((answer) => answer !== null).length;
}

function findNextQuestionIndex(answers: Array<number | null>, startIndex = 0): number | null {
  for (let index = startIndex; index < answers.length; index += 1) {
    if (answers[index] === null) {
      return index;
    }
  }

  return null;
}

function serializeSession(
  session: {
    id: string;
    userId: string;
    profileId: string | null;
    scaleId: string;
    status: string;
    channel: string;
    currentQuestionIndex: number | null;
    answers: unknown;
    formData: unknown;
    conversationState: unknown;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  },
  scale: ScaleDefinition
): AssessmentSessionState {
  const answers = normalizeSessionAnswers(session.answers, scale.questions.length);
  const conversationState = normalizeConversationState(session.conversationState);
  const currentQuestion =
    session.currentQuestionIndex !== null && session.currentQuestionIndex >= 0
      ? scale.questions[session.currentQuestionIndex]
      : undefined;

  return {
    sessionId: session.id,
    userId: session.userId,
    profileId: session.profileId,
    scaleId: session.scaleId,
    status: session.status as AssessmentSessionStatus,
    channel: session.channel as AssessmentSessionChannel,
    currentQuestionIndex: session.currentQuestionIndex,
    questionCount: scale.questions.length,
    answeredCount: countAnswered(answers),
    answers,
    formData:
      session.formData && typeof session.formData === 'object' && !Array.isArray(session.formData)
        ? (session.formData as Record<string, string | number | null>)
        : undefined,
    currentQuestion,
    result: conversationState.result,
    assessmentId: conversationState.assessmentId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
  };
}

async function getRawSession(sessionId: string, userId: string) {
  const session = await prisma.assessmentSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    throw new Error('Assessment session not found');
  }

  return session;
}

async function resolveQuotaDeviceId(userId: string, conversationState: SessionConversationState) {
  if (conversationState.quotaDeviceId) {
    return conversationState.quotaDeviceId;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceId: true },
  });

  if (!user?.deviceId) {
    throw new Error('No device is bound to the current user for quota accounting');
  }

  return user.deviceId;
}

export async function createAssessmentSession(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
  channel: AssessmentSessionChannel;
  formData?: Record<string, unknown>;
  deviceId?: string;
}) {
  const scale = getScaleOrThrow(input.scaleId);
  const hasPatientInfoFields = Boolean(scale.patientInfoFields?.length);
  const normalizedFormData = input.formData ? normalizeScaleFormData(scale.id, input.formData) : undefined;
  const status: AssessmentSessionStatus =
    hasPatientInfoFields && !normalizedFormData ? 'collecting_form' : 'questioning';
  const currentQuestionIndex = status === 'questioning' ? 0 : null;
  const session = await prisma.assessmentSession.create({
    data: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: scale.id,
      status,
      channel: input.channel,
      currentQuestionIndex,
      answers: JSON.parse(JSON.stringify(Array.from({ length: scale.questions.length }, () => null))),
      formData: normalizedFormData ? JSON.parse(JSON.stringify(normalizedFormData)) : undefined,
      conversationState: JSON.parse(
        JSON.stringify({
          quotaDeviceId: input.deviceId || null,
          evidence: [],
        } satisfies SessionConversationState)
      ),
    },
  });

  return serializeSession(session, scale);
}

export async function getAssessmentSession(sessionId: string, userId: string) {
  const session = await getRawSession(sessionId, userId);
  const scale = getScaleOrThrow(session.scaleId);
  return serializeSession(session, scale);
}

export async function submitAssessmentSessionAnswer(input: {
  sessionId: string;
  userId: string;
  score?: number;
  formData?: Record<string, unknown>;
  questionId?: number;
}) {
  const session = await getRawSession(input.sessionId, input.userId);
  const scale = getScaleOrThrow(session.scaleId);

  if (session.status === 'cancelled') {
    throw new Error('Assessment session has been cancelled');
  }

  if (session.status === 'completed') {
    return serializeSession(session, scale);
  }

  if (session.status === 'collecting_form') {
    const normalizedFormData = normalizeScaleFormData(scale.id, input.formData);
    const updated = await prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        status: 'questioning',
        formData: JSON.parse(JSON.stringify(normalizedFormData)),
        currentQuestionIndex: 0,
      },
    });
    return serializeSession(updated, scale);
  }

  if (session.status !== 'questioning') {
    throw new Error(`Assessment session is not answerable in status ${session.status}`);
  }

  if (typeof input.score !== 'number') {
    throw new Error('Missing answer score');
  }

  if (session.currentQuestionIndex === null || session.currentQuestionIndex < 0) {
    throw new Error('Current question is not available');
  }

  if (input.questionId !== undefined && input.questionId !== scale.questions[session.currentQuestionIndex]?.id) {
    throw new Error('Answer does not match the current question');
  }

  const answers = normalizeSessionAnswers(session.answers, scale.questions.length);
  answers[session.currentQuestionIndex] = input.score;
  const nextQuestionIndex = findNextQuestionIndex(answers, session.currentQuestionIndex + 1);

  if (nextQuestionIndex !== null) {
    const updated = await prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        answers: JSON.parse(JSON.stringify(answers)),
        currentQuestionIndex: nextQuestionIndex,
      },
    });
    return serializeSession(updated, scale);
  }

  const normalizedFormData =
    session.formData && typeof session.formData === 'object' && !Array.isArray(session.formData)
      ? (session.formData as Record<string, string | number | null>)
      : normalizeScaleFormData(scale.id, input.formData);
  const conversationState = normalizeConversationState(session.conversationState);
  const quotaDeviceId = await resolveQuotaDeviceId(input.userId, conversationState);
  const canConsume = await QuotaManager.consumeQuota(quotaDeviceId);
  if (!canConsume) {
    throw new Error('Quota exceeded for today');
  }

  const result = evaluateScaleAnswers(
    scale.id,
    answers.map((answer) => answer ?? 0),
    normalizedFormData
  );

  const assessment = await prisma.assessmentHistory.create({
    data: {
      userId: input.userId,
      profileId: session.profileId || null,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      totalScore: result.totalScore,
      conclusion: result.conclusion,
      answers: JSON.parse(JSON.stringify(answers)),
      formData: normalizedFormData ? JSON.parse(JSON.stringify(normalizedFormData)) : undefined,
      resultDetails: result.details ? JSON.parse(JSON.stringify(result.details)) : undefined,
    },
  });

  const updated = await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: 'completed',
      answers: JSON.parse(JSON.stringify(answers)),
      currentQuestionIndex: null,
      completedAt: new Date(),
      conversationState: JSON.parse(
        JSON.stringify({
          ...conversationState,
          result,
          assessmentId: assessment.id,
          quotaDeviceId,
        } satisfies SessionConversationState)
      ),
    },
  });

  return serializeSession(updated, scale);
}

export async function goBackAssessmentSession(input: { sessionId: string; userId: string }) {
  const session = await getRawSession(input.sessionId, input.userId);
  const scale = getScaleOrThrow(session.scaleId);

  if (session.status === 'completed' || session.status === 'cancelled') {
    return serializeSession(session, scale);
  }

  if (session.status === 'collecting_form') {
    return serializeSession(session, scale);
  }

  const answers = normalizeSessionAnswers(session.answers, scale.questions.length);
  const currentIndex = session.currentQuestionIndex ?? 0;
  const nextIndex = Math.max(currentIndex - 1, 0);
  const updated = await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      currentQuestionIndex: nextIndex,
      answers: JSON.parse(JSON.stringify(answers)),
    },
  });

  return serializeSession(updated, scale);
}

export async function cancelAssessmentSession(input: { sessionId: string; userId: string }) {
  const session = await getRawSession(input.sessionId, input.userId);
  const scale = getScaleOrThrow(session.scaleId);

  if (session.status === 'completed' || session.status === 'cancelled') {
    return serializeSession(session, scale);
  }

  const updated = await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: 'cancelled',
      currentQuestionIndex: null,
    },
  });

  return serializeSession(updated, scale);
}
