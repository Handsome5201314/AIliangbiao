import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getOrCreateAgentLiveExecution,
  serializeAgentLiveExecution,
} from '@/lib/agent/live-service';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

const requestSchema = z.object({
  goal: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    const execution = await getOrCreateAgentLiveExecution({
      session,
      goal: body.goal,
    });

    return NextResponse.json({
      success: true,
      ...serializeAgentLiveExecution(execution),
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create live session' },
      { status }
    );
  }
}
