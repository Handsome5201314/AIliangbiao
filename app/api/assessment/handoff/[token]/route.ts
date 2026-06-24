import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getPublicAssessmentSessionByToken,
  savePublicAssessmentSessionDraftByToken,
} from '@/lib/assessment-skill/scale-service';

const answerDetailSchema = z.object({
  estimated: z.boolean().optional(),
  selectedSymptomIds: z.array(z.string()).optional(),
  primarySymptomId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.string().optional(),
  source: z.enum(['manual', 'ai_mapped', 'user_confirmed_mapping']).optional(),
  confirmedLowConfidence: z.boolean().optional(),
});

const draftRequestSchema = z.object({
  answers: z.array(z.number().nullable()),
  answerDetails: z.record(z.string(), answerDetailSchema).optional(),
});

type PublicHandoffPayload =
  | Awaited<ReturnType<typeof getPublicAssessmentSessionByToken>>
  | Awaited<ReturnType<typeof savePublicAssessmentSessionDraftByToken>>;

function toRespondentPayload(payload: PublicHandoffPayload) {
  return {
    ...payload,
    session: {
      ...payload.session,
      resultVisibleToRespondent: false,
      result: null,
      assessmentHistoryId: null,
    },
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const payload = await getPublicAssessmentSessionByToken(token);

    return NextResponse.json({
      success: true,
      ...toRespondentPayload(payload),
    });
  } catch (error) {
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
      { error: error instanceof Error ? error.message : 'Failed to load assessment handoff' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = draftRequestSchema.parse(await request.json());
    const payload = await savePublicAssessmentSessionDraftByToken({
      publicToken: token,
      answers: body.answers,
      answerDetails: body.answerDetails,
    });

    return NextResponse.json({
      success: true,
      ...toRespondentPayload(payload),
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
      { error: error instanceof Error ? error.message : 'Failed to save assessment handoff draft' },
      { status: 500 }
    );
  }
}
