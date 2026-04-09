import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { getAssessmentSession } from '@/lib/assessment-skill/session-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:read');
    const { sessionId } = await context.params;
    const assessmentSession = await getAssessmentSession(sessionId, session.sub);

    return NextResponse.json({
      success: true,
      session: assessmentSession,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch assessment session' },
      { status: 401 }
    );
  }
}
