import { NextRequest, NextResponse } from 'next/server';

import { getOrBuildAgentProfileState } from '@/lib/services/agent-profile';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const { memberId } = await context.params;
    if (memberId !== session.member_id) {
      return NextResponse.json({ error: 'Forbidden member access' }, { status: 403 });
    }

    const profile = await getOrBuildAgentProfileState({
      userId: session.sub,
      memberId,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load agent profile' },
      { status: 401 }
    );
  }
}
