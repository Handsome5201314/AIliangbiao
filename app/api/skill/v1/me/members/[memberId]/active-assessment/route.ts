import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { getLatestActiveAssessmentSession } from '@/lib/assessment-skill/scale-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const { memberId } = await context.params;

    if (memberId !== session.member_id) {
      return NextResponse.json({ error: 'Forbidden member access' }, { status: 403 });
    }

    const activeSession = await getLatestActiveAssessmentSession({
      userId: session.sub,
      profileId: memberId,
    });

    return NextResponse.json({ session: activeSession });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
