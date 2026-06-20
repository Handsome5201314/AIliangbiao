import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { prisma } from '@/lib/db/prisma';
import { evaluateScaleAnswers, getScaleDefinitionById } from '@/lib/scales/catalog';
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

function normalizeAnswers(answers: unknown): number[] {
  if (!Array.isArray(answers)) return [];
  return answers.map((value) => Number(value));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { assessmentId } = await context.params;
    const assessment = await prisma.assessmentHistory.findFirst({
      where: {
        id: assessmentId,
        userId: user.id,
      },
      include: {
        profile: {
          select: {
            nickname: true,
            realName: true,
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const scale = getScaleDefinitionById(assessment.scaleId);
    if (!scale) {
      return NextResponse.json({ error: 'Scale not found' }, { status: 404 });
    }

    const answers = normalizeAnswers(assessment.answers);
    const recomputed = answers.length === scale.questions.length
      ? evaluateScaleAnswers(scale.id, answers)
      : {
          totalScore: assessment.totalScore,
          conclusion: assessment.conclusion,
          details: {},
        };
    const maxScore = scale.questions.reduce((sum, question) => {
      const maxOption = Math.max(...question.options.map((option) => option.score));
      return sum + (Number.isFinite(maxOption) ? maxOption : 0);
    }, 0);
    const risk = mapRisk(assessment.conclusion);

    return NextResponse.json({
      sessionId: assessment.id,
      scaleName: resolveLocalizedText(scale.title, 'zh'),
      childName: assessment.profile?.nickname || assessment.profile?.realName || '孩子',
      completedAt: assessment.createdAt.toISOString(),
      totalScore: assessment.totalScore,
      maxScore,
      riskLevel: risk.riskLevel,
      riskLabel: risk.riskLabel,
      summary: assessment.conclusion,
      dimensions: [],
      recommendations: [
        String(recomputed.details?.description || '建议结合孩子日常表现和专业医生评估综合判断。'),
        '本结果仅用于儿童发育行为筛查与随访参考，不能替代专业诊断。',
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
