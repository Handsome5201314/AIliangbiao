import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { createAssessmentSession } from '@/lib/assessment-skill/scale-service';
import type { LanguageCode } from '@/lib/schemas/core/types';

const requestSchema = z.object({
  memberId: z.string().optional(),
  language: z.enum(['zh', 'en']).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    const { scaleId } = await context.params;

    const assessmentSession = await createAssessmentSession({
      userId: session.sub,
      profileId: body.memberId || session.member_id,
      scaleId,
      language: body.language as LanguageCode | undefined,
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
      { error: error instanceof Error ? error.message : 'Failed to create assessment session' },
      { status: 500 }
    );
  }
}
