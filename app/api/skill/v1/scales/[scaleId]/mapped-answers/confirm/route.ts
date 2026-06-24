import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { confirmMappedScaleAnswer } from '@/lib/assessment-skill/scale-service';

const requestSchema = z.object({
  questionId: z.number(),
  score: z.number(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    authenticateSkillRequest(request, 'skill:scales:evaluate');
    const body = requestSchema.parse(await request.json());
    const { scaleId } = await context.params;

    return NextResponse.json({
      success: true,
      ...confirmMappedScaleAnswer({
        scaleId,
        questionId: body.questionId,
        score: body.score,
        confidence: body.confidence,
        evidence: body.evidence,
      }),
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
      { error: error instanceof Error ? error.message : 'Failed to confirm mapped answer' },
      { status: 500 }
    );
  }
}
