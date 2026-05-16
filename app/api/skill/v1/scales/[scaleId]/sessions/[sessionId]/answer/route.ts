import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { submitAssessmentAnswer } from '@/lib/assessment-skill/scale-service';

const requestSchema = z.object({
  questionId: z.number(),
  score: z.number(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string; sessionId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const body = requestSchema.parse(await request.json());
    const { scaleId, sessionId } = await context.params;

    const assessmentSession = await submitAssessmentAnswer({
      userId: session.sub,
      sessionId,
      questionId: body.questionId,
      score: body.score,
      scaleId,
    });

    return NextResponse.json({
      success: true,
      session: assessmentSession,
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
          data: (error as { data?: unknown }).data,
        },
        { status: (error as { statusCode: number }).statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit assessment answer' },
      { status: 500 }
    );
  }
}
