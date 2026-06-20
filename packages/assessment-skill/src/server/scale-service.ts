import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import {
  assertAccessibleMember,
  ensureMemberForDevice,
  resolveUserByDeviceId,
} from './member-service';
import type { AgentSessionPayload } from './auth';
import {
  evaluateScaleAnswers,
  getPublicClinicalChildScaleById,
  getScaleDefinitionById,
  getSerializableScaleById,
  isRespondentResultVisible,
  listPublicClinicalChildScales,
  listVoiceFriendlyChildScales,
  resolveScaleResultDeliveryMode,
} from '@/lib/scales/catalog';
import {
  normalizeScaleAnswerDetails,
  summarizeEstimatedAnswerDetails,
} from '@/lib/scales/answer-details';
import { assertAgentCanStartAssessment } from '@/lib/agent/quota';
import { isAiToyVoiceScale } from '@/lib/services/ai-toy-device-binding';
import {
  resolveFallbackExamples,
  resolveLocalizedText,
  resolveOptionDescription,
  resolveQuestionColloquial,
  resolveQuestionText,
  resolveSymptomOptionLabel,
} from '@/lib/schemas/core/i18n';
import type {
  ExecutableScaleDefinition,
  LanguageCode,
  ScaleDefinition,
  ScaleInteractionMode,
  ScaleAnswerDetailMap,
  ScaleResultDeliveryMode,
  ScaleQuestion,
  ScaleScoreResult,
  ScaleSymptomOption,
} from '@/lib/schemas/core/types';

const ASSESSMENT_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const PUBLIC_HANDOFF_TOKEN_TTL_MS = ASSESSMENT_SESSION_TIMEOUT_MS;

type SessionAnswerValue = number | null;

type SerializedScaleQuestion = {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  sectionKey?: string;
  sectionLabel?: string;
  subsectionKey?: string;
  subsectionLabel?: string;
  ageBandLabel?: string;
  supportsEstimate?: boolean;
  domainKey?: string;
  localQuestionNumber?: number;
  symptomOptions?: Array<{
    id: string;
    label: string;
  }>;
  imageUrl?: string;
  imageAlt?: string;
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
  interactionMode: ScaleInteractionMode;
  resultDeliveryMode: ScaleResultDeliveryMode;
  resultVisibleToRespondent: boolean;
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
  handoff?: {
    url: string;
    expiresAt: string;
  } | null;
  result: (ScaleScoreResult & { assessmentHistoryId?: string }) | null;
  assessmentHistoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type SerializedScaleDefinition = {
  id: string;
  version?: string;
  title: string;
  description: string;
  estimatedMinutes?: number;
  interactionMode: ScaleInteractionMode;
  resultDeliveryMode: ScaleResultDeliveryMode;
  questions: SerializedScaleQuestion[];
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

function resolveScaleInteractionMode(scale: Pick<ScaleDefinition, 'interactionMode'>): ScaleInteractionMode {
  return scale.interactionMode || 'manual_only';
}

function isWebHandoffScale(scale: Pick<ScaleDefinition, 'interactionMode'>) {
  return resolveScaleInteractionMode(scale) === 'web_handoff';
}

function shouldExposeResultToRespondent(scale: Pick<ScaleDefinition, 'resultDeliveryMode'>) {
  return isRespondentResultVisible(scale);
}

function buildPublicAssessmentToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function getPublicAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    'http://localhost:3000'
  );
}

function buildPublicHandoffUrl(publicToken: string) {
  return new URL(`/assessment/handoff/${publicToken}`, getPublicAppBaseUrl()).toString();
}

function buildExternalAgentMemberSnapshot(input: {
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
  const language = input.language === 'en' ? 'EN' : 'ZH';
  const snapshot = input.memberSnapshot;

  return {
    nickname:
      snapshot?.nickname?.trim() ||
      (input.language === 'en' ? 'Temporary Subject' : '临时受测对象'),
    gender: snapshot?.gender?.trim() || 'unknown',
    ageMonths: typeof snapshot?.ageMonths === 'number' ? snapshot.ageMonths : undefined,
    relation: snapshot?.relation?.trim() || 'SELF',
    languagePreference: snapshot?.languagePreference?.trim() || language,
    interests: snapshot?.interests || [],
    fears: snapshot?.fears || [],
    avatarConfig: snapshot?.avatarConfig,
  };
}

function serializeQuestion(question: ScaleQuestion, language: LanguageCode): SerializedScaleQuestion {
  return {
    id: question.id,
    text: resolveQuestionText(question, language),
    clinical_intent: question.clinical_intent,
    colloquial: resolveQuestionColloquial(question, language),
    fallback_examples: resolveFallbackExamples(question, language),
    ...(question.sectionKey ? { sectionKey: question.sectionKey } : {}),
    ...(question.sectionLabel
      ? { sectionLabel: resolveLocalizedText(question.sectionLabel, language) }
      : {}),
    ...(question.subsectionKey ? { subsectionKey: question.subsectionKey } : {}),
    ...(question.subsectionLabel
      ? { subsectionLabel: resolveLocalizedText(question.subsectionLabel, language) }
      : {}),
    ...(question.ageBandLabel ? { ageBandLabel: question.ageBandLabel } : {}),
    ...(typeof question.supportsEstimate === 'boolean'
      ? { supportsEstimate: question.supportsEstimate }
      : {}),
    ...(question.domainKey ? { domainKey: question.domainKey } : {}),
    ...(typeof question.localQuestionNumber === 'number'
      ? { localQuestionNumber: question.localQuestionNumber }
      : {}),
    ...(question.symptomOptions?.length
      ? {
          symptomOptions: question.symptomOptions.map((option) => ({
            id: option.id,
            label: resolveSymptomOptionLabel(option, language),
          })),
        }
      : {}),
    ...(question.imageUrl ? { imageUrl: question.imageUrl } : {}),
    ...(question.imageAlt
      ? { imageAlt: resolveLocalizedText(question.imageAlt, language) }
      : {}),
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

function serializeScaleDefinition(
  scale: ExecutableScaleDefinition,
  language: LanguageCode
): SerializedScaleDefinition {
  return {
    id: scale.id,
    version: scale.version,
    title: resolveLocalizedText(scale.title, language),
    description: resolveLocalizedText(scale.description, language),
    estimatedMinutes: scale.estimatedMinutes,
    interactionMode: resolveScaleInteractionMode(scale),
    resultDeliveryMode: resolveScaleResultDeliveryMode(scale),
    questions: scale.questions.map((question) => serializeQuestion(question, language)),
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

function buildSessionHandoff(record: NonNullable<AssessmentSessionRecord>, scale: ExecutableScaleDefinition) {
  if (!isWebHandoffScale(scale) || !record.publicToken) {
    return null;
  }

  const expiresAt = record.publicTokenExpiresAt
    ? new Date(record.publicTokenExpiresAt)
    : new Date(record.createdAt.getTime() + PUBLIC_HANDOFF_TOKEN_TTL_MS);

  return {
    url: buildPublicHandoffUrl(record.publicToken),
    expiresAt: expiresAt.toISOString(),
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

  const sessionExpired = Date.now() - record.updatedAt.getTime() > ASSESSMENT_SESSION_TIMEOUT_MS;
  const publicTokenExpired =
    record.publicTokenExpiresAt instanceof Date
      ? record.publicTokenExpiresAt.getTime() <= Date.now()
      : false;
  const isExpired = sessionExpired || publicTokenExpired;
  if (!isExpired) {
    return record;
  }

  return getAssessmentSessionModel().update({
    where: { id: record.id },
    data: { status: 'EXPIRED' },
  });
}

async function ensureWebHandoffAccess(
  record: NonNullable<AssessmentSessionRecord>,
  scale: ExecutableScaleDefinition
) {
  if (!isWebHandoffScale(scale) || !['ONGOING', 'PAUSED'].includes(record.status)) {
    return record;
  }

  const publicTokenExpiresAt =
    record.publicTokenExpiresAt instanceof Date ? record.publicTokenExpiresAt : null;
  const hasValidToken =
    typeof record.publicToken === 'string' &&
    record.publicToken.length > 0 &&
    publicTokenExpiresAt &&
    publicTokenExpiresAt.getTime() > Date.now();

  if (hasValidToken) {
    return record;
  }

  return getAssessmentSessionModel().update({
    where: { id: record.id },
    data: {
      publicToken: buildPublicAssessmentToken(),
      publicTokenExpiresAt: new Date(Date.now() + PUBLIC_HANDOFF_TOKEN_TTL_MS),
    },
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
  const interactionMode = resolveScaleInteractionMode(scale);
  const resultDeliveryMode = resolveScaleResultDeliveryMode(scale);
  const resultVisibleToRespondent = shouldExposeResultToRespondent(scale);
  const currentQuestionIndex =
    record.status === 'COMPLETED' ||
    record.status === 'CANCELLED' ||
    record.status === 'EXPIRED' ||
    interactionMode === 'web_handoff'
      ? null
      : getNextQuestionIndex(answers);
  const currentQuestion =
    currentQuestionIndex === null ? null : serializeQuestion(scale.questions[currentQuestionIndex], language);

  return {
    sessionId: record.id,
    scaleId: record.scaleId,
    scaleVersion: record.scaleVersion,
    language,
    interactionMode,
    resultDeliveryMode,
    resultVisibleToRespondent,
    status: record.status,
    answers,
    progress: buildProgress(answers, currentQuestionIndex),
    currentQuestion,
    handoff: buildSessionHandoff(record, scale),
    result:
      record.status === 'COMPLETED' &&
      record.totalScore !== null &&
      record.conclusion
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

function assertAllAnswersAllowed(scale: ExecutableScaleDefinition, answers: number[]) {
  if (answers.length !== scale.questions.length) {
    throw new AssessmentSessionServiceError(
      `Expected ${scale.questions.length} answers, received ${answers.length}`,
      400,
      'INVALID_ANSWER_COUNT'
    );
  }

  answers.forEach((score, index) => {
    const question = scale.questions[index];
    if (!question.options.some((option) => option.score === score)) {
      throw new AssessmentSessionServiceError(
        `Score ${score} is not valid for question ${question.id}`,
        400,
        'INVALID_SCORE'
      );
    }
  });
}

async function completeAssessmentSession(input: {
  record: NonNullable<AssessmentSessionRecord>;
  scale: ExecutableScaleDefinition;
  answers: number[];
  answerDetails?: ScaleAnswerDetailMap;
}) {
  const result = input.scale.calculateScore(input.answers);
  const normalizedAnswerDetails = normalizeScaleAnswerDetails(input.scale, input.answerDetails);
  const estimateSummary = summarizeEstimatedAnswerDetails(normalizedAnswerDetails);
  const resultDetails = {
    ...(result.details || {}),
    ...(normalizedAnswerDetails ? { answerDetails: normalizedAnswerDetails } : {}),
    ...(estimateSummary ? { estimateSummary } : {}),
  };

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
        resultDetails: Object.keys(resultDetails).length ? JSON.parse(JSON.stringify(resultDetails)) : undefined,
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
        resultDetails: Object.keys(resultDetails).length ? JSON.parse(JSON.stringify(resultDetails)) : undefined,
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

export async function getLatestActiveAssessmentSession(input: {
  userId: string;
  profileId?: string | null;
}) {
  if (input.profileId) {
    await assertAccessibleMember(input.userId, input.profileId);
  }

  const existing = await getAssessmentSessionModel().findFirst({
    where: {
      userId: input.userId,
      profileId: input.profileId || null,
      status: {
        in: ['ONGOING', 'PAUSED'],
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!existing) {
    return null;
  }

  const record = await expireSessionIfNeeded(existing);
  if (!record || record.status === 'EXPIRED') {
    return null;
  }

  const scale = getExecutableScaleOrThrow(record.scaleId);
  const sessionRecord = await ensureWebHandoffAccess(record, scale);
  return buildAssessmentSessionState(sessionRecord, scale);
}

function serializeSkillScale(scale: ScaleDefinition & { questions: ScaleQuestion[] }) {
  return {
    ...scale,
    interactionMode: scale.interactionMode || 'manual_only',
    supportedLanguages: scale.supportedLanguages || ['zh'],
    requiresConfirmation: scale.requiresConfirmation ?? false,
    questionCount: scale.questions.length,
  };
}

export function listSkillScales() {
  return listPublicClinicalChildScales().map((scale: ScaleDefinition & { questions: ScaleQuestion[] }) =>
    serializeSkillScale(scale)
  );
}

export function listAiToyVoiceSkillScales() {
  return listVoiceFriendlyChildScales()
    .filter((scale) => isAiToyVoiceScale(scale.id))
    .map((scale: ScaleDefinition & { questions: ScaleQuestion[] }) => serializeSkillScale(scale));
}

export function getSkillScale(scaleId: string) {
  return getPublicClinicalChildScaleById(scaleId);
}

export async function evaluateSkillScale(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
  answers: number[];
  answerDetails?: ScaleAnswerDetailMap;
}) {
  const scale = getSerializableScaleById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  if (input.answers.length !== scale.questions.length) {
    throw new Error(`Expected ${scale.questions.length} answers, received ${input.answers.length}`);
  }

  const result = evaluateScaleAnswers(scale.id, input.answers);
  const normalizedAnswerDetails = normalizeScaleAnswerDetails(scale, input.answerDetails);
  const estimateSummary = summarizeEstimatedAnswerDetails(normalizedAnswerDetails);
  const resultDetails = {
    ...(result.details || {}),
    ...(normalizedAnswerDetails ? { answerDetails: normalizedAnswerDetails } : {}),
    ...(estimateSummary ? { estimateSummary } : {}),
  };

  const assessment = await prisma.assessmentHistory.create({
    data: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      totalScore: result.totalScore,
      conclusion: result.conclusion,
      answers: JSON.parse(JSON.stringify(input.answers)),
      resultDetails: Object.keys(resultDetails).length ? JSON.parse(JSON.stringify(resultDetails)) : undefined,
    },
  });

  return {
    assessmentId: assessment.id,
    scaleId: scale.id,
    result: {
      ...result,
      details: Object.keys(resultDetails).length ? resultDetails : result.details,
    },
    createdAt: assessment.createdAt,
  };
}

export async function createAssessmentSession(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
  language?: LanguageCode;
  channel?: string | null;
  agentSession?: AgentSessionPayload;
}) {
  const scale = getExecutableScaleOrThrow(input.scaleId);

  if (input.profileId) {
    await assertAccessibleMember(input.userId, input.profileId);
  }

  const reusable = await resolveLatestReusableSession(input);
  if (reusable && reusable.status !== 'EXPIRED') {
    const sessionRecord = await ensureWebHandoffAccess(reusable, scale);
    return buildAssessmentSessionState(sessionRecord, scale);
  }

  if (input.agentSession?.entrypoint === 'agent') {
    await assertAgentCanStartAssessment(input.agentSession);
  }

  const answers = Array.from({ length: scale.questions.length }, () => null);
  const created = await getAssessmentSessionModel().create({
    data: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      channel: input.channel || null,
      language: input.language === 'en' ? 'EN' : 'ZH',
      status: 'ONGOING',
      publicToken: isWebHandoffScale(scale) ? buildPublicAssessmentToken() : null,
      publicTokenExpiresAt: isWebHandoffScale(scale)
        ? new Date(Date.now() + PUBLIC_HANDOFF_TOKEN_TTL_MS)
        : null,
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
  const sessionRecord = await ensureWebHandoffAccess(record, scale);
  return buildAssessmentSessionState(sessionRecord, scale);
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
  if (isWebHandoffScale(scale)) {
    throw new AssessmentSessionServiceError(
      'This assessment must be completed through the public handoff form',
      409,
      'SESSION_WEB_HANDOFF_REQUIRED'
    );
  }
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

async function getAssessmentSessionRecordByPublicToken(publicToken: string) {
  return getAssessmentSessionModel().findFirst({
    where: { publicToken },
  });
}

async function resolvePublicAssessmentSessionRecord(publicToken: string) {
  const initialRecord = await getAssessmentSessionRecordByPublicToken(publicToken);
  if (!initialRecord) {
    throw new AssessmentSessionServiceError('Assessment handoff session not found', 404, 'SESSION_NOT_FOUND');
  }

  const record = await expireSessionIfNeeded(initialRecord);
  if (!record) {
    throw new AssessmentSessionServiceError('Assessment handoff session not found', 404, 'SESSION_NOT_FOUND');
  }

  const scale = getExecutableScaleOrThrow(record.scaleId);
  if (!isWebHandoffScale(scale)) {
    throw new AssessmentSessionServiceError(
      'Assessment handoff is not enabled for this scale',
      404,
      'SESSION_NOT_WEB_HANDOFF'
    );
  }

  return {
    record: await ensureWebHandoffAccess(record, scale),
    scale,
  };
}

export async function getPublicAssessmentSessionByToken(publicToken: string) {
  const { record, scale } = await resolvePublicAssessmentSessionRecord(publicToken);
  const language = resolveSessionLanguage(record.language);

  return {
    session: buildAssessmentSessionState(record, scale),
    scale: serializeScaleDefinition(scale, language),
  };
}

export async function submitPublicAssessmentSessionByToken(input: {
  publicToken: string;
  answers: number[];
  answerDetails?: ScaleAnswerDetailMap;
}) {
  const { record, scale } = await resolvePublicAssessmentSessionRecord(input.publicToken);
  assertSessionIsMutable(record);
  assertAllAnswersAllowed(scale, input.answers);

  const updatedRecord = await completeAssessmentSession({
    record,
    scale,
    answers: input.answers,
    answerDetails: input.answerDetails,
  });

  return {
    session: buildAssessmentSessionState(updatedRecord, scale),
    scale: serializeScaleDefinition(scale, resolveSessionLanguage(updatedRecord.language)),
  };
}

export async function generateAssessmentLinkForDevice(input: {
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
  const session = await createAssessmentSessionForDevice(input);

  if (session.interactionMode !== 'web_handoff' || !session.handoff) {
    throw new AssessmentSessionServiceError(
      `Scale ${input.scaleId} does not support web handoff`,
      409,
      'SCALE_NOT_WEB_HANDOFF',
      { session }
    );
  }

  return session;
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
    memberSnapshot: buildExternalAgentMemberSnapshot({
      language: input.language,
      memberSnapshot: input.memberSnapshot,
    }),
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
