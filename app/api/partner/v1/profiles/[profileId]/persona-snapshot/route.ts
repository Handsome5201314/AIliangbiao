import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { exportPersonaSnapshot } from '@/lib/partner/personaSnapshot';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { profileId } = await context.params;

    const snapshot = await exportPersonaSnapshot({
      userId: user.id,
      profileId,
    });

    return NextResponse.json(snapshot, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成人格快照失败';
    const status =
      message === 'Profile not found'
        ? 404
        : message === '尚未完成足够的基础量表测试'
          ? 404
          : message === 'Patient account required' || message === 'Missing Bearer token'
            ? 401
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
