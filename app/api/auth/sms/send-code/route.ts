import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { AuthVerificationError, sendVerificationCode } from '@/lib/services/authVerification';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

const requestSchema = z.object({
  phone: z.string().min(1),
  purpose: z.enum(['register', 'login', 'reset_password']),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const normalizedPhone = normalizeOptionalPhone(body.phone);

    if (!normalizedPhone) {
      return NextResponse.json({ error: '请输入有效手机号' }, { status: 400 });
    }

    const existingPatientUser = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        accountType: 'PATIENT',
        isGuest: false,
      },
      select: {
        id: true,
      },
    });

    if (body.purpose === 'register' && existingPatientUser) {
      return NextResponse.json({ error: '该手机号已注册，请直接登录' }, { status: 409 });
    }

    if ((body.purpose === 'login' || body.purpose === 'reset_password') && !existingPatientUser) {
      return NextResponse.json({ error: '该手机号尚未注册' }, { status: 404 });
    }

    const result = await sendVerificationCode({
      phone: normalizedPhone,
      purpose: body.purpose,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthVerificationError) {
      return NextResponse.json(
        {
          error: error.message,
          cooldownSeconds: error.cooldownSeconds,
          expiresInSeconds: error.expiresInSeconds,
        },
        { status: error.status }
      );
    }

    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send verification code' },
      { status }
    );
  }
}
