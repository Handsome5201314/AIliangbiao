import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { submitPublicAssessmentSessionByToken } from '@/lib/assessment-skill/scale-service';
import { dispatchAssessmentCompletionCallback, getAssessmentCompletionCallbackStatus } from '@/lib/services/assessment-callbacks';
import { isRespondentResultVisible } from '@/lib/scales/catalog';

function toRespondentPayload(payload: Awaited<ReturnType<typeof submitPublicAssessmentSessionByToken>>) {
  const visible = isRespondentResultVisible(payload.scale);
  return {
    ...payload,
    session: {
      ...payload.session,
      resultVisibleToRespondent: visible,
      result: visible ? payload.session.result : null,
    },
  };
}

const requestSchema = z.object({
  answers: z.array(z.number()),
  answerDetails: z.record(z.string(), z.object({
    estimated: z.boolean().optional(),
    selectedSymptomIds: z.array(z.string()).optional(),
    primarySymptomId: z.string().optional(),
  })).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = requestSchema.parse(await request.json());
    const payload = await submitPublicAssessmentSessionByToken({
      publicToken: token,
      answers: body.answers,
      answerDetails: body.answerDetails,
    });
    let callback = null;
    if (payload.session.result) {
      await dispatchAssessmentCompletionCallback({
        assessmentSessionId: payload.session.sessionId,
        sessionId: payload.session.sessionId,
        scaleId: payload.session.scaleId,
        result: {
          scaleId: payload.session.scaleId,
          totalScore: payload.session.result.totalScore,
          conclusion: payload.session.result.conclusion,
          details: payload.session.result.details,
          assessmentHistoryId: payload.session.assessmentHistoryId,
        },
        submittedAt: payload.session.completedAt ? new Date(payload.session.completedAt).toISOString() : null,
      });
      callback = await getAssessmentCompletionCallbackStatus(payload.session.sessionId);
    }

    return NextResponse.json({
      success: true,
      ...toRespondentPayload(payload),
      ...(callback ? { callback } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    if (error instanceof Error && 'statusCode' in error) {
      return NextResponse.json(
        {
          error: error.message,
          code: (error as { code?: string }).code,
        },
        { status: (error as { statusCode: number }).statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit assessment handoff' },
      { status: 500 }
    );
  }
}
