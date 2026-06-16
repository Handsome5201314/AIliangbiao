import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getAdminPolicies } from '@/lib/services/admin-policies';
import { createDoctorSensitiveAccessTicket } from '@/lib/services/doctor-sensitive-access';

const sensitiveAccessSchema = z.object({
  memberId: z.string().min(1),
  purpose: z.string().trim().min(6).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const { user, doctorProfile } = await requireApprovedDoctorUser(request);
    const body = sensitiveAccessSchema.parse(await request.json());
    const policies = await getAdminPolicies();

    const result = await createDoctorSensitiveAccessTicket({
      actorUserId: user.id,
      doctorProfileId: doctorProfile.id,
      organizationId: doctorProfile.organizationId || null,
      memberId: body.memberId,
      purpose: body.purpose,
      ttlMinutes: policies.sensitiveAccess.ticketTtlMinutes,
    });

    return NextResponse.json({
      ...result,
      policy: {
        requireConfirmation: policies.sensitiveAccess.requireConfirmation,
        blockOnAuditFailure: policies.sensitiveAccess.blockOnAuditFailure,
        ticketTtlMinutes: policies.sensitiveAccess.ticketTtlMinutes,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '敏感访问请求格式不合法' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : '敏感访问票据签发失败';
    const status =
      /doctor|unauthorized|approved|not found|member/i.test(message)
        ? 401
        : /forbidden|assignment/i.test(message)
          ? 403
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
