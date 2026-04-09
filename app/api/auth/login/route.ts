import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { loginAccount } from '@/lib/auth/account-service';
import { attachUserSessionCookie } from '@/lib/auth/user-session';

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await loginAccount(body);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        role: user.role,
        doctorProfile: user.doctorProfile,
      },
    });
    attachUserSessionCookie(response, {
      userId: user.id,
      accountType: user.accountType as 'PATIENT' | 'DOCTOR',
    });
    return response;
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status }
    );
  }
}
