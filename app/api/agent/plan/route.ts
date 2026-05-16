import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAgentPlan } from '@/lib/agent/orchestrator';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

const requestSchema = z.object({
  goal: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const body = requestSchema.parse(await request.json());
    const result = await createAgentPlan({
      session,
      goal: body.goal,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create plan' },
      { status }
    );
  }
}
