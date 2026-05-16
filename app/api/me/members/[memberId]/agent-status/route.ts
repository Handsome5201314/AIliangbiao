import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { getMemberAgentStatus } from '@/lib/services/doctor-bot';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;

    const status = await getMemberAgentStatus({
      userId: user.id,
      memberId,
    });

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
