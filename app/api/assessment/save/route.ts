import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { getScaleDefinitionById } from '@/lib/scales/catalog';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, profileId, scaleId, totalScore, conclusion, answers } = body;

    if (!deviceId || !scaleId || totalScore === undefined || !conclusion || !answers) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const user = await QuotaManager.getOrCreateGuest(deviceId);
    const scale = getScaleDefinitionById(scaleId);
    const scaleVersion = scale?.version || '1.0';

    const assessment = await prisma.assessmentHistory.create({
      data: {
        userId: user.id,
        profileId: profileId || null,
        scaleId,
        scaleVersion,
        totalScore: parseFloat(Number(totalScore).toFixed(2)),
        conclusion,
        answers: JSON.parse(JSON.stringify(answers)),
      },
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
