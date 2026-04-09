import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { registerPatientAccount } from '@/lib/auth/account-service';
import { attachUserSessionCookie } from '@/lib/auth/user-session';

const requestSchema = z.object({
  deviceId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  consentAccepted: z.literal(true),
  consentVersion: z.string().min(1),
  profile: z
    .object({
      relation: z.string().optional(),
      languagePreference: z.string().optional(),
      nickname: z.string().optional(),
      gender: z.string().optional(),
      ageMonths: z.number().nullable().optional(),
      interests: z.array(z.string()).optional(),
      fears: z.array(z.string()).optional(),
      avatarState: z.any().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await registerPatientAccount({
      ...body,
      request,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        role: user.role,
      },
    });
    attachUserSessionCookie(response, {
      userId: user.id,
      accountType: 'PATIENT',
    });
    return response;
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '患者注册失败' },
      { status }
    );
  }
}
