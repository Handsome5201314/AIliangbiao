import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { extractAppBearerToken, verifyAppSessionToken } from '@/lib/auth/app-session';
import { evaluateScaleAnswers, getScaleDefinitionById } from '@/lib/scales/catalog';
import { normalizeScaleAnswerDetails, summarizeEstimatedAnswerDetails } from '@/lib/scales/answer-details';
import { assertDoctorCanWriteMember, logPatientWriteAction } from '@/lib/services/care-teams';
import { ensurePendingDoctorReviewForAssessment } from '@/lib/services/doctor-care';
import type { ExecutableScaleDefinition } from '@/lib/schemas/core/types';

type AssessmentOwner = {
  userId: string;
  profileId: string | null;
  actorDoctorProfileId?: string;
};

const LOW_CONFIDENCE_CONFIRMATION_THRESHOLD = 0.8;

async function resolveOwnedProfile(userId: string, profileId?: string | null) {
  if (!profileId) return null;

  const profile = await prisma.memberProfile.findFirst({
    where: {
      id: profileId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!profile) {
    throw new Error('Member not found or not owned by current user');
  }

  return profile.id;
}

async function resolveAssessmentOwner(
  request: NextRequest,
  input: { deviceId?: string; profileId?: string | null }
): Promise<AssessmentOwner> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  if (authHeader) {
    const session = verifyAppSessionToken(extractAppBearerToken(request));

    if (session.accountType === 'PATIENT') {
      return {
        userId: session.sub,
        profileId: await resolveOwnedProfile(session.sub, input.profileId),
      };
    }

    if (session.accountType === 'DOCTOR') {
      if (!session.doctorProfileId || !input.profileId) {
        throw new Error('Doctor assessment save requires a patient profile');
      }

      await assertDoctorCanWriteMember(input.profileId, session.doctorProfileId);
      const profile = await prisma.memberProfile.findUnique({
        where: { id: input.profileId },
        select: { id: true, userId: true },
      });
      if (!profile) {
        throw new Error('Patient member not found');
      }

      return {
        userId: profile.userId,
        profileId: profile.id,
        actorDoctorProfileId: session.doctorProfileId,
      };
    }

    throw new Error('Unsupported account type');
  }

  if (!input.deviceId) {
    throw new Error('缺少 deviceId 或登录会话');
  }

  const user = await QuotaManager.getOrCreateGuest(input.deviceId);
  return {
    userId: user.id,
    profileId: await resolveOwnedProfile(user.id, input.profileId),
  };
}

function normalizeDeterministicAnswers(scale: ExecutableScaleDefinition, rawAnswers: unknown) {
  if (!Array.isArray(rawAnswers)) {
    return {
      error: 'answers 必须是按题目顺序排列的分值数组',
      answers: null,
    };
  }

  if (rawAnswers.length !== scale.questions.length) {
    return {
      error: `答案数量不匹配，需要 ${scale.questions.length} 个答案，实际 ${rawAnswers.length} 个`,
      answers: null,
    };
  }

  const answers: number[] = [];
  for (let index = 0; index < rawAnswers.length; index += 1) {
    const score = Number(rawAnswers[index]);
    const question = scale.questions[index];

    if (!Number.isFinite(score) || !question.options.some((option) => option.score === score)) {
      return {
        error: `第 ${index + 1} 题答案分值无效`,
        answers: null,
      };
    }

    answers.push(score);
  }

  return {
    error: null,
    answers,
  };
}

function assertConfirmedLowConfidenceAnswers(answerDetails: unknown) {
  if (!answerDetails || typeof answerDetails !== 'object' || Array.isArray(answerDetails)) {
    return null;
  }

  const unconfirmedQuestionIds = Object.entries(answerDetails as Record<string, {
    confidence?: unknown;
    confirmedLowConfidence?: unknown;
  }>)
    .filter(([, detail]) => (
      typeof detail.confidence === 'number' &&
      Number.isFinite(detail.confidence) &&
      detail.confidence < LOW_CONFIDENCE_CONFIRMATION_THRESHOLD &&
      detail.confirmedLowConfidence !== true
    ))
    .map(([questionId]) => questionId);

  return unconfirmedQuestionIds.length
    ? {
        error: 'LOW_CONFIDENCE_CONFIRMATION_REQUIRED',
        questionIds: unconfirmedQuestionIds,
      }
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, profileId, scaleId, answers, sessionId } = body;

    if (!scaleId || !answers) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const owner = await resolveAssessmentOwner(request, { deviceId, profileId });
    const scale = getScaleDefinitionById(scaleId);
    if (!scale) {
      return NextResponse.json({ error: '量表不存在' }, { status: 404 });
    }

    const normalized = normalizeDeterministicAnswers(scale, answers);
    if (!normalized.answers) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const deterministicAnswers = normalized.answers;
    const lowConfidenceError = assertConfirmedLowConfidenceAnswers(body.answerDetails);
    if (lowConfidenceError) {
      return NextResponse.json(
        {
          error: '低置信度答案需要家长确认后才能保存',
          code: lowConfidenceError.error,
          questionIds: lowConfidenceError.questionIds,
        },
        { status: 400 }
      );
    }

    const result = evaluateScaleAnswers(scale.id, deterministicAnswers);
    const normalizedAnswerDetails = normalizeScaleAnswerDetails(scale, body.answerDetails);
    const estimateSummary = summarizeEstimatedAnswerDetails(normalizedAnswerDetails);
    const resultDetails = {
      ...(result.details || {}),
      ...(normalizedAnswerDetails ? { answerDetails: normalizedAnswerDetails } : {}),
      ...(estimateSummary ? { estimateSummary } : {}),
    };
    const scaleVersion = scale.version || '1.0';
    const assessmentSession = sessionId
      ? await prisma.assessmentSession.findFirst({
          where: {
            id: sessionId,
            userId: owner.userId,
            ...(owner.profileId ? { profileId: owner.profileId } : {}),
          },
        })
      : null;

    if (sessionId && !assessmentSession) {
      throw new Error('Assessment session not found for this submission');
    }

    const serializedAnswers = JSON.parse(JSON.stringify(deterministicAnswers));
    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessmentHistory.create({
        data: {
          userId: owner.userId,
          profileId: owner.profileId,
          scaleId: scale.id,
          scaleVersion,
          totalScore: result.totalScore,
          conclusion: result.conclusion,
          answers: serializedAnswers,
          resultDetails: Object.keys(resultDetails).length ? JSON.parse(JSON.stringify(resultDetails)) : undefined,
        },
      });

      if (assessmentSession) {
        await tx.assessmentSession.update({
          where: { id: assessmentSession.id },
          data: {
            status: 'COMPLETED',
            answers: serializedAnswers,
            currentQuestionIndex: scale.questions.length,
            totalScore: result.totalScore,
            conclusion: result.conclusion,
            resultDetails: Object.keys(resultDetails).length ? JSON.parse(JSON.stringify(resultDetails)) : undefined,
            assessmentHistoryId: created.id,
            completedAt: new Date(),
          },
        });
      }

      return created;
    });

    if (owner.actorDoctorProfileId && owner.profileId) {
      await logPatientWriteAction({
        actorDoctorProfileId: owner.actorDoctorProfileId,
        memberId: owner.profileId,
        action: 'DOCTOR_MOBILE_ASSESSMENT_COMPLETED',
        metadata: {
          assessmentId: assessment.id,
          sessionId: assessmentSession?.id,
          scaleId: scale.id,
        },
      });
    }

    await ensurePendingDoctorReviewForAssessment({
      assessmentHistoryId: assessment.id,
      assessmentSessionId: assessmentSession?.id || null,
      memberProfileId: owner.profileId,
      doctorProfileId: owner.actorDoctorProfileId,
    });

    return NextResponse.json({
      success: true,
      assessment: {
        id: assessment.id,
        scaleId: assessment.scaleId,
        totalScore: assessment.totalScore,
        conclusion: assessment.conclusion,
        createdAt: assessment.createdAt,
      },
    });
  } catch (error) {
    console.error('[Save Assessment Error]:', error);
    return NextResponse.json(
      { error: '保存评估结果失败，请稍后重试' },
      { status: 500 }
    );
  }
}
