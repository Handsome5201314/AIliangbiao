import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import {
  cancelAssessmentSession,
  getAssessmentSession,
} from '@/lib/assessment-skill/scale-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string; sessionId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:read');
    const { scaleId, sessionId } = await context.params;

    const assessmentSession = await getAssessmentSession({
      userId: session.sub,
      sessionId,
      scaleId,
    });

    return NextResponse.json({
      success: true,
      session: assessmentSession,
    });
  } catch (error) {
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
      { error: error instanceof Error ? error.message : 'Failed to load assessment session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string; sessionId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const { scaleId, sessionId } = await context.params;

    const assessmentSession = await cancelAssessmentSession({
      userId: session.sub,
      sessionId,
      scaleId,
    });

    return NextResponse.json({
      success: true,
      session: assessmentSession,
    });
  } catch (error) {
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
      { error: error instanceof Error ? error.message : 'Failed to cancel assessment session' },
      { status: 500 }
    );
  }
}
