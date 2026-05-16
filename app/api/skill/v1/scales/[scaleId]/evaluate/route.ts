import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { assertAccessibleMember } from '@/lib/assessment-skill/member-service';
import { evaluateSkillScale } from '@/lib/assessment-skill/scale-service';
import { getSerializableScaleById, isRespondentResultVisible, resolveScaleResultDeliveryMode } from '@/lib/scales/catalog';

const requestSchema = z.object({
  memberId: z.string().optional(),
  answers: z.array(z.number()),
  answerDetails: z.record(z.string(), z.object({
    estimated: z.boolean().optional(),
    selectedSymptomIds: z.array(z.string()).optional(),
    primarySymptomId: z.string().optional(),
  })).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const body = requestSchema.parse(await request.json());
    const { scaleId } = await context.params;
    const memberId = body.memberId || session.member_id;

    await assertAccessibleMember(session.sub, memberId);

    const evaluation = await evaluateSkillScale({
      userId: session.sub,
      profileId: memberId,
      scaleId,
      answers: body.answers,
      answerDetails: body.answerDetails,
    });
    const scale = getSerializableScaleById(scaleId);
    const resultVisibleToRespondent = scale ? isRespondentResultVisible(scale) : true;
    const resultDeliveryMode = scale ? resolveScaleResultDeliveryMode(scale) : 'immediate';

    return NextResponse.json({
      success: true,
      assessmentId: evaluation.assessmentId,
      scaleId: evaluation.scaleId,
      resultDeliveryMode,
      resultVisibleToRespondent,
      result: resultVisibleToRespondent ? evaluation.result : null,
      createdAt: evaluation.createdAt,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate scale' },
      { status }
    );
  }
}
