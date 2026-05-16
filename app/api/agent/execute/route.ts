import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { executeAgentPlan } from '@/lib/agent/orchestrator';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

const requestSchema = z.object({
  executionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const body = requestSchema.parse(await request.json());
    const execution = await executeAgentPlan({
      session,
      executionId: body.executionId,
    });

    return NextResponse.json({ execution });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute plan' },
      { status }
    );
  }
}
