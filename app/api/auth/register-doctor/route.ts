import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { registerDoctorAccount } from '@/lib/auth/account-service';
import { attachUserSessionCookie } from '@/lib/auth/user-session';

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  realName: z.string().min(1),
  hospitalName: z.string().min(1),
  departmentName: z.string().min(1),
  title: z.string().min(1),
  licenseNo: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await registerDoctorAccount(body);

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
      accountType: 'DOCTOR',
    });
    return response;
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '医生注册失败' },
      { status }
    );
  }
}
