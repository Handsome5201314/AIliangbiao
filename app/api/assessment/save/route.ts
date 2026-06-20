import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { extractAppBearerToken, verifyAppSessionToken } from '@/lib/auth/app-session';
import { getScaleDefinitionById } from '@/lib/scales/catalog';
import { assertDoctorCanWriteMember, logPatientWriteAction } from '@/lib/services/care-teams';

type AssessmentOwner = {
  userId: string;
  profileId: string | null;
  actorDoctorProfileId?: string;
};

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, profileId, scaleId, totalScore, conclusion, answers, sessionId } = body;

    if (!scaleId || totalScore === undefined || !conclusion || !answers) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const owner = await resolveAssessmentOwner(request, { deviceId, profileId });
    const scale = getScaleDefinitionById(scaleId);
    const scaleVersion = scale?.version || '1.0';
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

    const normalizedScore = parseFloat(Number(totalScore).toFixed(2));
    const serializedAnswers = JSON.parse(JSON.stringify(answers));
    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessmentHistory.create({
        data: {
          userId: owner.userId,
          profileId: owner.profileId,
          scaleId,
          scaleVersion,
          totalScore: normalizedScore,
          conclusion,
          answers: serializedAnswers,
        },
      });

      if (assessmentSession) {
        await tx.assessmentSession.update({
          where: { id: assessmentSession.id },
          data: {
            status: 'COMPLETED',
            answers: serializedAnswers,
            totalScore: normalizedScore,
            conclusion,
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
          scaleId,
        },
      });
    }

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
