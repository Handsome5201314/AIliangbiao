import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { prisma } from '@/lib/db/prisma';
import { getScaleDefinitionById } from '@/lib/scales/catalog';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

function mapRisk(conclusion: string) {
  if (/重度|高度|高风险|明显|severe|high/i.test(conclusion)) {
    return { riskLevel: 'high', riskLabel: '高度关注' };
  }
  if (/中度|建议|关注|moderate/i.test(conclusion)) {
    return { riskLevel: 'moderate', riskLabel: '中度关注' };
  }
  return { riskLevel: 'low', riskLabel: '低风险' };
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requirePatientUser(request);
    const profileId = request.nextUrl.searchParams.get('profileId') || undefined;

    if (profileId) {
      const ownedProfile = await prisma.memberProfile.findFirst({
        where: { id: profileId, userId: user.id },
        select: { id: true },
      });

      if (!ownedProfile) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
    }

    const assessments = await prisma.assessmentHistory.findMany({
      where: {
        userId: user.id,
        profileId,
      },
      include: {
        profile: {
          select: {
            id: true,
            nickname: true,
            realName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      history: assessments.map((assessment) => {
        const scale = getScaleDefinitionById(assessment.scaleId);
        const risk = mapRisk(assessment.conclusion);

        return {
          id: assessment.id,
          sessionId: assessment.id,
          scaleId: assessment.scaleId,
          scaleName: scale ? resolveLocalizedText(scale.title, 'zh') : assessment.scaleId,
          childId: assessment.profileId,
          childName: assessment.profile?.nickname || assessment.profile?.realName || '孩子',
          completedAt: assessment.createdAt.toISOString(),
          status: 'completed',
          ...risk,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
