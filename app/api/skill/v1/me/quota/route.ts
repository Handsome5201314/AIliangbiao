import { NextRequest, NextResponse } from 'next/server';

import { QuotaManager } from '@/lib/auth/quotaManager';
import { getAgentQuotaSummary } from '@/lib/agent/quota';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';

export async function GET(request: NextRequest) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const summary = await getAgentQuotaSummary(session);

    if (summary.scope === 'agent') {
      return NextResponse.json({
        scope: 'agent',
        unlimited: false,
        remaining: summary.remaining,
        dailyLimit: summary.dailyLimit,
        dailyUsed: summary.dailyUsed,
        warnAtRemaining: summary.warnAtRemaining,
        isGuest: session.role === 'GUEST',
        role: session.role,
      });
    }

    const user = await QuotaManager.getOrCreateGuest(session.device_id);

    return NextResponse.json({
      scope: 'app',
      unlimited: true,
      remaining: null,
      dailyLimit: null,
      dailyUsed: null,
      warnAtRemaining: null,
      isGuest: user.isGuest,
      role: (user as { role?: string }).role || (user.isGuest ? 'GUEST' : 'REGISTERED'),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
