import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { findUserForLogin } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await findUserForLogin(body.email);

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    const session = issueAppSessionToken({
      userId: user.id,
      accountType: user.accountType as 'PATIENT' | 'DOCTOR',
      role: user.role,
      email: user.email || undefined,
      doctorProfileId: user.doctorProfile?.id,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        role: user.role,
        doctorProfile: user.doctorProfile
          ? {
              id: user.doctorProfile.id,
              verificationStatus: user.doctorProfile.verificationStatus,
              realName: user.doctorProfile.realName,
              hospitalName: user.doctorProfile.hospitalName,
              departmentName: user.doctorProfile.departmentName,
              title: user.doctorProfile.title,
            }
          : null,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '登录失败' },
      { status }
    );
  }
}
