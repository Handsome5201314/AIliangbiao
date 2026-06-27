import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { QuotaManager } from '@/lib/auth/quotaManager';

const requestSchema = z.object({
  deviceId: z.string().trim().min(8).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await QuotaManager.getOrCreateGuest(body.deviceId);
    const session = issueAppSessionToken({
      userId: user.id,
      accountType: 'PATIENT',
      role: user.role,
      email: user.email || undefined,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      deviceId: body.deviceId,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        accountType: 'PATIENT',
        role: user.role,
        isGuest: user.isGuest,
        doctorProfile: null,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '游客登录失败',
      },
      { status }
    );
  }
}
