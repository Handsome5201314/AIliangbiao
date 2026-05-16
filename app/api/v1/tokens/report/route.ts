import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { resolveAppUserFromOptionalAccessToken } from '@/lib/auth/agentpit-oauth';

const requestSchema = z
  .object({
    clientId: z.string().optional(),
    client_id: z.string().optional(),
    clientSecret: z.string().optional(),
    client_secret: z.string().optional(),
    accessToken: z.string().optional(),
    access_token: z.string().optional(),
    agentId: z.string().optional(),
    agent_id: z.string().optional(),
    tokensUsed: z.number().int().positive().optional(),
    tokens_used: z.number().int().positive().optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    input_tokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    startedAt: z.string().datetime().optional(),
    started_at: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    ended_at: z.string().datetime().optional(),
    modelName: z.string().optional(),
    model_name: z.string().optional(),
    requestId: z.string().optional(),
    request_id: z.string().optional(),
    requestPath: z.string().optional(),
    request_path: z.string().optional(),
    responseTimeMs: z.number().int().nonnegative().optional(),
    response_time_ms: z.number().int().nonnegative().optional(),
    responseStatus: z.number().int().nonnegative().optional(),
    response_status: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((body) => ({
    clientId: body.clientId || body.client_id || '',
    clientSecret: body.clientSecret || body.client_secret || '',
    accessToken: body.accessToken || body.access_token || undefined,
    agentId: body.agentId || body.agent_id || '',
    tokensUsed: body.tokensUsed ?? body.tokens_used ?? 0,
    inputTokens: body.inputTokens ?? body.input_tokens,
    outputTokens: body.outputTokens ?? body.output_tokens,
    startedAt: body.startedAt || body.started_at || '',
    endedAt: body.endedAt || body.ended_at || '',
    modelName: body.modelName || body.model_name,
    requestId: body.requestId || body.request_id,
    requestPath: body.requestPath || body.request_path,
    responseTimeMs: body.responseTimeMs ?? body.response_time_ms,
    responseStatus: body.responseStatus ?? body.response_status,
    metadata: body.metadata,
  }))
  .superRefine((body, ctx) => {
    if (!body.clientId) {
      ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'clientId 不能为空' });
    }
    if (!body.clientSecret) {
      ctx.addIssue({ code: 'custom', path: ['clientSecret'], message: 'clientSecret 不能为空' });
    }
    if (!body.agentId) {
      ctx.addIssue({ code: 'custom', path: ['agentId'], message: 'agentId 不能为空' });
    }
    if (!body.tokensUsed || body.tokensUsed <= 0) {
      ctx.addIssue({ code: 'custom', path: ['tokensUsed'], message: 'tokensUsed 必须为正整数' });
    }
    if (!body.startedAt) {
      ctx.addIssue({ code: 'custom', path: ['startedAt'], message: 'startedAt 不能为空' });
    }
    if (!body.endedAt) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'endedAt 不能为空' });
    }
  });

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const expectedClientId = process.env.AGENTPIT_CLIENT_ID || '';
  const expectedClientSecret = process.env.AGENTPIT_CLIENT_SECRET || '';

  if (!expectedClientId || !expectedClientSecret) {
    return err('AgentPit token report credentials are not configured', 500);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message || 'Invalid request body');
    }

    const body = parsed.data;
    if (body.clientId !== expectedClientId || body.clientSecret !== expectedClientSecret) {
      return err('Invalid client credentials', 401);
    }

    const startedAt = new Date(body.startedAt);
    const endedAt = new Date(body.endedAt);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
      return err('startedAt / endedAt 必须是 ISO 日期格式');
    }
    if (startedAt >= endedAt) {
      return err('startedAt 必须早于 endedAt');
    }

    const reporter = await resolveAppUserFromOptionalAccessToken(
      body.accessToken ||
        (request.headers.get('authorization')?.startsWith('Bearer ')
          ? request.headers.get('authorization')?.slice('Bearer '.length).trim()
          : undefined)
    );

    if (body.requestId) {
      const existing = await prisma.tokenUsage.findFirst({
        where: {
          clientId: body.clientId,
          requestId: body.requestId,
        },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          data: {
            id: existing.id,
            agentId: existing.agentId,
            tokensUsed: existing.tokensUsed,
            startedAt: existing.startedAt,
            endedAt: existing.endedAt,
            createdAt: existing.createdAt,
          },
        });
      }
    }

    const usage = await prisma.$transaction(async (tx) => {
      const created = await tx.tokenUsage.create({
        data: {
          userId: reporter?.id || null,
          clientId: body.clientId,
          agentId: body.agentId,
          tokensUsed: body.tokensUsed,
          inputTokens: body.inputTokens,
          outputTokens: body.outputTokens,
          startedAt,
          endedAt,
          modelName: body.modelName,
          requestId: body.requestId,
          requestPath: body.requestPath,
          responseTimeMs: body.responseTimeMs,
          responseStatus: body.responseStatus,
          metadata: body.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      if (reporter?.id) {
        await tx.user.update({
          where: { id: reporter.id },
          data: {
            totalTokens: {
              increment: body.tokensUsed,
            },
          },
        });
      }

      return created;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: usage.id,
        agentId: usage.agentId,
        tokensUsed: usage.tokensUsed,
        startedAt: usage.startedAt,
        endedAt: usage.endedAt,
        createdAt: usage.createdAt,
      },
    });
  } catch (error) {
    console.error('[tokens/report] POST error:', error);
    return err(error instanceof Error ? error.message : 'Server error', 500);
  }
}
