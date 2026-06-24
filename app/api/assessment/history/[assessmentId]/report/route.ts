import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { prisma } from '@/lib/db/prisma';
import { evaluateScaleAnswers, getScaleDefinitionById } from '@/lib/scales/catalog';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import {
  assertPatientCanViewReviewedAssessmentReport,
  getPatientVisibleAssessmentReport,
  PatientReportVisibilityError,
} from '@/lib/services/doctor-care';
import { recordReportView } from '@/lib/services/research-events';

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

    await assertPatientCanViewReviewedAssessmentReport({
      userId: user.id,
      assessmentId: assessment.id,
      scaleId: scale.id,
    });

    const formalReport =
      scale.resultDeliveryMode === 'physician_review'
        ? await getPatientVisibleAssessmentReport({
            userId: user.id,
            assessmentId: assessment.id,
          })
        : null;

    await recordReportView({
      actor: { user },
      memberProfileId: assessment.profileId,
      assessmentHistoryId: assessment.id,
      viewerRole: 'PATIENT',
      metadata: {
        reportNo: formalReport?.report.reportNo || null,
        formalReport: Boolean(formalReport),
      },
    });

    if (formalReport) {
      const snapshot = formalReport.snapshot;
      const maxScore = snapshot.result.dimensionRows.reduce(
        (sum, item) => sum + (item.maxScore || 0),
        0
      );
      const risk = mapRisk(snapshot.result.conclusion);

      return NextResponse.json({
        sessionId: assessment.id,
        reportNo: snapshot.reportNo,
        scaleName: snapshot.scale.name,
        childName: snapshot.child.displayName,
        completedAt: snapshot.assessment.assessedAt,
        totalScore: snapshot.result.totalScore,
        maxScore,
        riskLevel: risk.riskLevel,
        riskLabel: risk.riskLabel,
        summary: snapshot.result.resultExplanation,
        dimensions: snapshot.result.dimensionRows.map((item) => ({
          name: item.label,
          score: item.score,
          maxScore: item.maxScore,
        })),
        recommendations: [
          snapshot.result.resultExplanation,
          snapshot.safetyNotice,
        ].filter(Boolean),
      });
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
    if (error instanceof PatientReportVisibilityError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'PENDING_DOCTOR_REVIEW',
          status: 'PENDING_DOCTOR_REVIEW',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
