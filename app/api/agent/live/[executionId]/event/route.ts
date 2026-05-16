import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  appendAgentLiveExecutionEvent,
  serializeAgentLiveExecution,
} from '@/lib/agent/live-service';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

const requestSchema = z.object({
  type: z.enum(['plan', 'running', 'page_focus', 'action', 'result', 'failed', 'paused', 'takeover', 'resumed']),
  message: z.string().min(1),
  view: z
    .object({
      kind: z.enum(['workspace', 'assessment', 'handoff', 'result']),
      title: z.string(),
      href: z.string(),
      anchor: z.string().optional(),
      pendingAction: z.string().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ executionId: string }> }
) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const { executionId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const execution = await appendAgentLiveExecutionEvent({
      session,
      executionId,
      ...body,
    });

    return NextResponse.json({
      success: true,
      ...serializeAgentLiveExecution(execution),
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 404;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to append live event' },
      { status }
    );
  }
}
