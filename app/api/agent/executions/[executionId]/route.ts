import { NextRequest, NextResponse } from 'next/server';

import { getAgentExecution } from '@/lib/agent/orchestrator';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ executionId: string }> }
) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const { executionId } = await context.params;
    const execution = await getAgentExecution({
      session,
      executionId,
    });

    return NextResponse.json({ execution });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch execution' },
      { status: 404 }
    );
  }
}
