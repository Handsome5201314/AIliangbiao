import { NextRequest, NextResponse } from 'next/server';

import { exportPersonaSnapshot } from '@/lib/partner/personaSnapshot';
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

    const snapshot = await exportPersonaSnapshot({
      userId: session.sub,
      profileId: memberId,
    });

    return NextResponse.json(snapshot, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export persona snapshot';
    const status = message === '尚未完成足够的基础量表测试' ? 404 : 401;

    return NextResponse.json({ error: message }, { status });
  }
}
