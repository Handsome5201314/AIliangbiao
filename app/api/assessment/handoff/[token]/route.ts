import { NextRequest, NextResponse } from 'next/server';

import { getPublicAssessmentSessionByToken } from '@/lib/assessment-skill/scale-service';
import { isRespondentResultVisible } from '@/lib/scales/catalog';

function toRespondentPayload(payload: Awaited<ReturnType<typeof getPublicAssessmentSessionByToken>>) {
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
