import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  controlAgentLiveExecution,
  serializeAgentLiveExecution,
} from '@/lib/agent/live-service';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

const requestSchema = z.object({
  action: z.enum(['pause', 'takeover', 'resume', 'manual_complete']),
  message: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ executionId: string }> }
) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const { executionId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const execution = await controlAgentLiveExecution({
      session,
      executionId,
      action: body.action,
      message: body.message,
    });

    return NextResponse.json({
      success: true,
      ...serializeAgentLiveExecution(execution),
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 404;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to control live execution' },
      { status }
    );
  }
}
