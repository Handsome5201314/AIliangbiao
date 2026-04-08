import { NextRequest, NextResponse } from 'next/server';

import { QuotaManager } from '@/lib/auth/quotaManager';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';

export async function GET(request: NextRequest) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const user = await QuotaManager.getOrCreateGuest(session.device_id);
    const remaining = Math.max(0, user.dailyLimit - user.dailyUsed);

    return NextResponse.json({
      remaining,
      dailyLimit: user.dailyLimit,
      dailyUsed: user.dailyUsed,
      isGuest: user.isGuest,
      role: (user as any).role || (user.isGuest ? 'GUEST' : 'REGISTERED'),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
