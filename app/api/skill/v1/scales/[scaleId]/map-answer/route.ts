import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { mapNaturalLanguageScaleAnswer } from '@/lib/assessment-skill/scale-service';

const requestSchema = z.object({
  questionId: z.number(),
  text: z.string().min(1),
  language: z.enum(['zh', 'en']).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');
    const body = requestSchema.parse(await request.json());
    const { scaleId } = await context.params;

    return NextResponse.json({
      success: true,
      ...mapNaturalLanguageScaleAnswer({
        scaleId,
        questionId: body.questionId,
        text: body.text,
        language: body.language,
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
      { error: error instanceof Error ? error.message : 'Failed to map answer' },
      { status: 500 }
    );
  }
}
