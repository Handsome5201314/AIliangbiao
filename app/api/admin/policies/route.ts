import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { getAdminPolicies, saveAdminPolicies } from '@/lib/services/admin-policies';

const policiesSchema = z.object({
  policies: z.object({
    sensitiveAccess: z.object({
      requireConfirmation: z.boolean(),
      ticketTtlMinutes: z.number().int().positive(),
      blockOnAuditFailure: z.boolean(),
    }),
    knowledgeReview: z.object({
      requireAdminReview: z.boolean(),
      allowOrganizationReviewer: z.boolean(),
      pendingSlaHours: z.number().int().positive(),
    }),
    explanation: z.object({
      knowledgeDefaultMode: z.enum(['platform_proxy', 'direct_fastgpt']),
      allowDoctorSupplement: z.boolean(),
      fallbackToStandardExplanation: z.boolean(),
    }),
    runtime: z.object({
      runtimeErrorThresholdPercent: z.number().int().positive(),
      enableDoctorBotFallback: z.boolean(),
      enforceTenantIsolation: z.boolean(),
    }),
    rateLimits: z.object({
      agentSessionPerDevicePerMinute: z.number().int().positive(),
      questionExplanationPerMinute: z.number().int().positive(),
      webhookPerChannelPerMinute: z.number().int().positive(),
    }),
  }),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN],
    });

    const policies = await getAdminPolicies();
    return NextResponse.json({ policies });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json({ error: '获取治理策略失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN],
    });

    const payload = policiesSchema.parse(await request.json());
    const policies = await saveAdminPolicies(payload.policies);

    return NextResponse.json({ policies });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '治理策略格式不合法' }, { status: 400 });
    }

    return NextResponse.json({ error: '保存治理策略失败' }, { status: 500 });
  }
}
