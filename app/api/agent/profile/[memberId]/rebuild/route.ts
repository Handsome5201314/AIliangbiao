import { NextRequest, NextResponse } from 'next/server';

import { rebuildAgentProfileState } from '@/lib/services/agent-profile';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const { memberId } = await context.params;
    if (memberId !== session.member_id) {
      return NextResponse.json({ error: 'Forbidden member access' }, { status: 403 });
    }

    const profile = await rebuildAgentProfileState({
      userId: session.sub,
      memberId,
      trigger: 'manual_rebuild',
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rebuild agent profile' },
      { status: 401 }
    );
  }
}
