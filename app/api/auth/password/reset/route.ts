import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { AuthVerificationError, verifyVerificationCode } from '@/lib/services/authVerification';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

const requestSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(4),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const normalizedPhone = normalizeOptionalPhone(body.phone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: '请输入有效手机号' }, { status: 400 });
    }

    await verifyVerificationCode({
      phone: normalizedPhone,
      purpose: 'reset_password',
      code: body.code,
    });

    const user = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        accountType: 'PATIENT',
        isGuest: false,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '该手机号尚未注册' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof AuthVerificationError
          ? error.status
          : 500;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '重置密码失败' },
      { status }
    );
  }
}
