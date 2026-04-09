import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { cancelAssessmentSession } from '@/lib/assessment-skill/session-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const { sessionId } = await context.params;
    const assessmentSession = await cancelAssessmentSession({
      sessionId,
      userId: session.sub,
    });

    return NextResponse.json({
      success: true,
      session: assessmentSession,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel assessment session' },
      { status: 401 }
    );
  }
}
