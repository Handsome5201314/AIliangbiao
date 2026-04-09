import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { submitAssessmentSessionAnswer } from '@/lib/assessment-skill/session-service';

const requestSchema = z.object({
  score: z.number().optional(),
  questionId: z.number().optional(),
  formData: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const body = requestSchema.parse(await request.json());
    const { sessionId } = await context.params;

    const assessmentSession = await submitAssessmentSessionAnswer({
      sessionId,
      userId: session.sub,
      score: body.score,
      questionId: body.questionId,
      formData: body.formData,
    });

    return NextResponse.json({
      success: true,
      session: assessmentSession,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit assessment answer' },
      { status }
    );
  }
}
