import { prisma } from '@/lib/db/prisma';
import {
  assertAccessibleMember,
  ensureMemberForDevice,
  resolveUserByDeviceId,
} from './member-service';
import {
  evaluateScaleAnswers,
  getScaleDefinitionById,
  getSerializableScaleById,
  listSerializableScales,
} from '@/lib/scales/catalog';
import {
  resolveFallbackExamples,
  resolveLocalizedText,
  resolveOptionDescription,
  resolveQuestionColloquial,
  resolveQuestionText,
} from '@/lib/schemas/core/i18n';
import type {
  ExecutableScaleDefinition,
  LanguageCode,
  ScaleDefinition,
  ScaleQuestion,
  ScaleScoreResult,
} from '@/lib/schemas/core/types';

const ASSESSMENT_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

type SessionAnswerValue = number | null;

type SerializedScaleQuestion = {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  options: Array<{
    label: string;
    score: number;
    aliases?: string[];
    description?: string;
  }>;
  riskLevel?: ScaleQuestion['riskLevel'];
};

type SerializedAssessmentSessionState = {
  sessionId: string;
  scaleId: string;
  scaleVersion: string;
  language: LanguageCode;
  status: string;
  answers: SessionAnswerValue[];
  progress: {
    answered: number;
    total: number;
    remaining: number;
    ratio: number;
    currentQuestionIndex: number | null;
  };
  currentQuestion: SerializedScaleQuestion | null;
  result: (ScaleScoreResult & { assessmentHistoryId?: string }) | null;
  assessmentHistoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type AssessmentSessionRecord = Awaited<ReturnType<typeof getAssessmentSessionRecord>>;

export class AssessmentSessionServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly data?: unknown
  ) {
    super(message);
    this.name = 'AssessmentSessionServiceError';
  }
}

function resolveSessionLanguage(language?: string | null): LanguageCode {
  return String(language || 'ZH').toUpperCase() === 'EN' ? 'en' : 'zh';
}

function serializeQuestion(question: ScaleQuestion, language: LanguageCode): SerializedScaleQuestion {
  return {
    id: question.id,
    text: resolveQuestionText(question, language),
    clinical_intent: question.clinical_intent,
    colloquial: resolveQuestionColloquial(question, language),
    fallback_examples: resolveFallbackExamples(question, language),
    options: question.options.map((option) => ({
      label: option.label,
      score: option.score,
      ...(option.aliases?.length ? { aliases: option.aliases } : {}),
      ...(resolveOptionDescription(option, language)
        ? { description: resolveOptionDescription(option, language) }
        : {}),
    })),
    ...(question.riskLevel ? { riskLevel: question.riskLevel } : {}),
  };
}

function normalizeSessionAnswers(rawAnswers: unknown, questionCount: number): SessionAnswerValue[] {
  const source = Array.isArray(rawAnswers) ? rawAnswers : [];

  return Array.from({ length: questionCount }, (_, index) => {
    const value = source[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  });
}

function getNextQuestionIndex(answers: SessionAnswerValue[]): number | null {
  const nextIndex = answers.findIndex((answer) => answer === null);
  return nextIndex === -1 ? null : nextIndex;
}

function buildProgress(answers: SessionAnswerValue[], currentQuestionIndex: number | null) {
  const answered = answers.filter((answer) => answer !== null).length;
  const total = answers.length;

  return {
    answered,
    total,
    remaining: total - answered,
    ratio: total === 0 ? 0 : answered / total,
    currentQuestionIndex,
  };
}

function getAssessmentSessionModel() {
  return (prisma as any).assessmentSession;
}

function getExecutableScaleOrThrow(scaleId: string): ExecutableScaleDefinition {
  const scale = getScaleDefinitionById(scaleId);
  if (!scale) {
    throw new AssessmentSessionServiceError(`Scale ${scaleId} not found`, 404, 'SCALE_NOT_FOUND');
  }

  return scale;
}

async function getAssessmentSessionRecord(sessionId: string) {
  return getAssessmentSessionModel().findUnique({
    where: { id: sessionId },
  });
}

async function expireSessionIfNeeded(record: AssessmentSessionRecord) {
  if (!record) {
    return record;
  }

  if (!['ONGOING', 'PAUSED'].includes(record.status)) {
    return record;
  }

  const isExpired = Date.now() - record.updatedAt.getTime() > ASSESSMENT_SESSION_TIMEOUT_MS;
  if (!isExpired) {
    return record;
  }

  return getAssessmentSessionModel().update({
    where: { id: record.id },
    data: { status: 'EXPIRED' },
  });
}

async function resolveAssessmentSessionRecord(input: {
  userId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const initialRecord = await getAssessmentSessionRecord(input.sessionId);

  if (!initialRecord || initialRecord.userId !== input.userId) {
    throw new AssessmentSessionServiceError('Assessment session not found', 404, 'SESSION_NOT_FOUND');
  }

  const record = await expireSessionIfNeeded(initialRecord);
  if (!record) {
    throw new AssessmentSessionServiceError('Assessment session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (input.scaleId && record.scaleId.toUpperCase() !== input.scaleId.toUpperCase()) {
    throw new AssessmentSessionServiceError('Assessment session does not match the requested scale', 404, 'SESSION_SCALE_MISMATCH');
  }

  return record;
}

function buildAssessmentSessionState(
  record: NonNullable<AssessmentSessionRecord>,
  scale: ExecutableScaleDefinition
): SerializedAssessmentSessionState {
  const language = resolveSessionLanguage(record.language);
  const answers = normalizeSessionAnswers(record.answers, scale.questions.length);
  const currentQuestionIndex =
    record.status === 'COMPLETED' || record.status === 'CANCELLED' || record.status === 'EXPIRED'
      ? null
      : getNextQuestionIndex(answers);
  const currentQuestion =
    currentQuestionIndex === null ? null : serializeQuestion(scale.questions[currentQuestionIndex], language);

  return {
    sessionId: record.id,
    scaleId: record.scaleId,
    scaleVersion: record.scaleVersion,
    language,
    status: record.status,
    answers,
    progress: buildProgress(answers, currentQuestionIndex),
    currentQuestion,
    result:
      record.status === 'COMPLETED' && record.totalScore !== null && record.conclusion
        ? {
            totalScore: record.totalScore,
            conclusion: record.conclusion,
            ...(record.resultDetails ? { details: record.resultDetails as ScaleScoreResult['details'] } : {}),
            ...(record.assessmentHistoryId ? { assessmentHistoryId: record.assessmentHistoryId } : {}),
          }
        : null,
    assessmentHistoryId: record.assessmentHistoryId || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt || null,
  };
}

function assertSessionIsMutable(record: NonNullable<AssessmentSessionRecord>) {
  if (record.status === 'COMPLETED') {
    throw new AssessmentSessionServiceError(
      'Assessment session has already been completed',
      409,
      'SESSION_COMPLETED'
    );
  }

  if (record.status === 'CANCELLED') {
    throw new AssessmentSessionServiceError(
      'Assessment session has been cancelled',
      409,
      'SESSION_CANCELLED'
    );
  }

  if (record.status === 'EXPIRED') {
    throw new AssessmentSessionServiceError(
      'Assessment session has expired',
      409,
      'SESSION_EXPIRED'
    );
  }
}

function assertScoreAllowed(question: ScaleQuestion | undefined, score: number, state: SerializedAssessmentSessionState) {
  if (!question) {
    throw new AssessmentSessionServiceError('Question not found', 404, 'QUESTION_NOT_FOUND');
  }

  if (!question.options.some((option) => option.score === score)) {
    throw new AssessmentSessionServiceError(
      `Score ${score} is not valid for question ${question.id}`,
      400,
      'INVALID_SCORE',
      { session: state }
    );
  }
}

async function completeAssessmentSession(input: {
  record: NonNullable<AssessmentSessionRecord>;
  scale: ExecutableScaleDefinition;
  answers: number[];
}) {
  const result = input.scale.calculateScore(input.answers);

  return prisma.$transaction(async (tx) => {
    const assessmentSessionTx = tx as any;

    const existingSession = await assessmentSessionTx.assessmentSession.findUnique({
      where: { id: input.record.id },
    });

    if (!existingSession) {
      throw new AssessmentSessionServiceError('Assessment session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (existingSession.assessmentHistoryId) {
      return assessmentSessionTx.assessmentSession.findUniqueOrThrow({
        where: { id: input.record.id },
      });
    }

    const assessment = await tx.assessmentHistory.create({
      data: {
        userId: input.record.userId,
        profileId: input.record.profileId || null,
        scaleId: input.record.scaleId,
        scaleVersion: input.record.scaleVersion || input.scale.version || '1.0',
        totalScore: result.totalScore,
        conclusion: result.conclusion,
        answers: JSON.parse(JSON.stringify(input.answers)),
      },
    });

    await assessmentSessionTx.assessmentSession.update({
      where: { id: input.record.id },
      data: {
        answers: JSON.parse(JSON.stringify(input.answers)),
        currentQuestionIndex: input.scale.questions.length,
        status: 'COMPLETED',
        totalScore: result.totalScore,
        conclusion: result.conclusion,
        resultDetails: result.details ? JSON.parse(JSON.stringify(result.details)) : undefined,
        assessmentHistoryId: assessment.id,
        completedAt: new Date(),
      },
    });

    return assessmentSessionTx.assessmentSession.findUniqueOrThrow({
      where: { id: input.record.id },
    });
  });
}

async function resolveLatestReusableSession(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
}) {
  const existing = await getAssessmentSessionModel().findFirst({
    where: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: input.scaleId,
      status: {
        in: ['ONGOING', 'PAUSED'],
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!existing) {
    return null;
  }

  return expireSessionIfNeeded(existing);
}

export function listSkillScales() {
  return listSerializableScales().map((scale: ScaleDefinition & { questions: ScaleQuestion[] }) => ({
    ...scale,
    interactionMode: scale.interactionMode || 'manual_only',
    supportedLanguages: scale.supportedLanguages || ['zh'],
    requiresConfirmation: scale.requiresConfirmation ?? false,
    questionCount: scale.questions.length,
  }));
}

export function getSkillScale(scaleId: string) {
  return getSerializableScaleById(scaleId);
}

export async function evaluateSkillScale(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
  answers: number[];
}) {
  const scale = getSerializableScaleById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  if (input.answers.length !== scale.questions.length) {
    throw new Error(`Expected ${scale.questions.length} answers, received ${input.answers.length}`);
  }

  const result = evaluateScaleAnswers(scale.id, input.answers);

  const assessment = await prisma.assessmentHistory.create({
    data: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      totalScore: result.totalScore,
      conclusion: result.conclusion,
      answers: JSON.parse(JSON.stringify(input.answers)),
    },
  });

  return {
    assessmentId: assessment.id,
    scaleId: scale.id,
    result,
    createdAt: assessment.createdAt,
  };
}

export async function createAssessmentSession(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
  language?: LanguageCode;
}) {
  const scale = getExecutableScaleOrThrow(input.scaleId);

  if (input.profileId) {
    await assertAccessibleMember(input.userId, input.profileId);
  }

  const reusable = await resolveLatestReusableSession(input);
  if (reusable && reusable.status !== 'EXPIRED') {
    return buildAssessmentSessionState(reusable, scale);
  }

  const answers = Array.from({ length: scale.questions.length }, () => null);
  const created = await getAssessmentSessionModel().create({
    data: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      language: input.language === 'en' ? 'EN' : 'ZH',
      status: 'ONGOING',
      answers: JSON.parse(JSON.stringify(answers)),
      currentQuestionIndex: 0,
    },
  });

  return buildAssessmentSessionState(created, scale);
}

export async function getAssessmentSession(input: {
  userId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const record = await resolveAssessmentSessionRecord(input);
  const scale = getExecutableScaleOrThrow(record.scaleId);
  return buildAssessmentSessionState(record, scale);
}

export async function submitAssessmentAnswer(input: {
  userId: string;
  sessionId: string;
  questionId: number;
  score: number;
  scaleId?: string;
}) {
  const record = await resolveAssessmentSessionRecord(input);
  assertSessionIsMutable(record);

  const scale = getExecutableScaleOrThrow(record.scaleId);
  const state = buildAssessmentSessionState(record, scale);
  const currentQuestion = state.currentQuestion;

  if (!currentQuestion || currentQuestion.id !== input.questionId) {
    throw new AssessmentSessionServiceError(
      'Submitted question does not match the current assessment question',
      409,
      'QUESTION_OUT_OF_ORDER',
      { session: state }
    );
  }

  const question = scale.questions.find((item) => item.id === input.questionId);
  assertScoreAllowed(question, input.score, state);

  const answers = [...state.answers];
  const currentIndex = state.progress.currentQuestionIndex;

  if (currentIndex === null) {
    throw new AssessmentSessionServiceError(
      'Assessment session has no active question',
      409,
      'QUESTION_OUT_OF_ORDER',
      { session: state }
    );
  }

  answers[currentIndex] = input.score;
  const nextQuestionIndex = getNextQuestionIndex(answers);

  const updatedRecord =
    nextQuestionIndex === null
      ? await completeAssessmentSession({
          record,
          scale,
          answers: answers as number[],
        })
      : await getAssessmentSessionModel().update({
          where: { id: record.id },
          data: {
            answers: JSON.parse(JSON.stringify(answers)),
            currentQuestionIndex: nextQuestionIndex,
            status: record.status === 'PAUSED' ? 'ONGOING' : record.status,
          },
        });

  return buildAssessmentSessionState(updatedRecord, scale);
}

export async function getAssessmentSessionResult(input: {
  userId: string;
  sessionId: string;
  scaleId?: string;
}) {
  return getAssessmentSession(input);
}

export async function pauseAssessmentSession(input: {
  userId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const record = await resolveAssessmentSessionRecord(input);

  if (record.status === 'ONGOING') {
    const updated = await getAssessmentSessionModel().update({
      where: { id: record.id },
      data: { status: 'PAUSED' },
    });
    return buildAssessmentSessionState(updated, getExecutableScaleOrThrow(updated.scaleId));
  }

  return buildAssessmentSessionState(record, getExecutableScaleOrThrow(record.scaleId));
}

export async function resumeAssessmentSession(input: {
  userId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const record = await resolveAssessmentSessionRecord(input);
  assertSessionIsMutable(record);

  if (record.status === 'PAUSED') {
    const updated = await getAssessmentSessionModel().update({
      where: { id: record.id },
      data: { status: 'ONGOING' },
    });
    return buildAssessmentSessionState(updated, getExecutableScaleOrThrow(updated.scaleId));
  }

  return buildAssessmentSessionState(record, getExecutableScaleOrThrow(record.scaleId));
}

export async function cancelAssessmentSession(input: {
  userId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const record = await resolveAssessmentSessionRecord(input);

  if (record.status === 'COMPLETED' || record.status === 'CANCELLED' || record.status === 'EXPIRED') {
    return buildAssessmentSessionState(record, getExecutableScaleOrThrow(record.scaleId));
  }

  const updated = await getAssessmentSessionModel().update({
    where: { id: record.id },
    data: { status: 'CANCELLED' },
  });

  return buildAssessmentSessionState(updated, getExecutableScaleOrThrow(updated.scaleId));
}

export async function createAssessmentSessionForDevice(input: {
  deviceId: string;
  scaleId: string;
  memberId?: string;
  language?: LanguageCode;
  memberSnapshot?: {
    nickname?: string;
    gender?: string;
    ageMonths?: number;
    relation?: string;
    languagePreference?: string;
    interests?: string[];
    fears?: string[];
    avatarConfig?: unknown;
  };
}) {
  const { user, member } = await ensureMemberForDevice({
    deviceId: input.deviceId,
    memberId: input.memberId,
    memberSnapshot: input.memberSnapshot,
  });

  return createAssessmentSession({
    userId: user.id,
    profileId: member.id,
    scaleId: input.scaleId,
    language: input.language,
  });
}

async function resolveUserSessionAccessByDevice(deviceId: string, sessionId: string) {
  const user = await resolveUserByDeviceId(deviceId);
  if (!user) {
    throw new AssessmentSessionServiceError('User not found for device', 404, 'USER_NOT_FOUND');
  }

  return {
    userId: user.id,
    sessionId,
  };
}

export async function getAssessmentSessionForDevice(input: {
  deviceId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const access = await resolveUserSessionAccessByDevice(input.deviceId, input.sessionId);
  return getAssessmentSession({
    userId: access.userId,
    sessionId: access.sessionId,
    scaleId: input.scaleId,
  });
}

export async function submitAssessmentAnswerForDevice(input: {
  deviceId: string;
  sessionId: string;
  questionId: number;
  score: number;
  scaleId?: string;
}) {
  const access = await resolveUserSessionAccessByDevice(input.deviceId, input.sessionId);
  return submitAssessmentAnswer({
    userId: access.userId,
    sessionId: access.sessionId,
    questionId: input.questionId,
    score: input.score,
    scaleId: input.scaleId,
  });
}

export async function getAssessmentSessionResultForDevice(input: {
  deviceId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const access = await resolveUserSessionAccessByDevice(input.deviceId, input.sessionId);
  return getAssessmentSessionResult({
    userId: access.userId,
    sessionId: access.sessionId,
    scaleId: input.scaleId,
  });
}

export async function pauseAssessmentSessionForDevice(input: {
  deviceId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const access = await resolveUserSessionAccessByDevice(input.deviceId, input.sessionId);
  return pauseAssessmentSession({
    userId: access.userId,
    sessionId: access.sessionId,
    scaleId: input.scaleId,
  });
}

export async function resumeAssessmentSessionForDevice(input: {
  deviceId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const access = await resolveUserSessionAccessByDevice(input.deviceId, input.sessionId);
  return resumeAssessmentSession({
    userId: access.userId,
    sessionId: access.sessionId,
    scaleId: input.scaleId,
  });
}

export async function cancelAssessmentSessionForDevice(input: {
  deviceId: string;
  sessionId: string;
  scaleId?: string;
}) {
  const access = await resolveUserSessionAccessByDevice(input.deviceId, input.sessionId);
  return cancelAssessmentSession({
    userId: access.userId,
    sessionId: access.sessionId,
    scaleId: input.scaleId,
  });
}
