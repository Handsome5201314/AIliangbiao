import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { createPatientAccount } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  deviceId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await createPatientAccount({
      email: body.email,
      phone: body.phone,
      passwordHash,
      deviceId: body.deviceId,
    });

    const session = issueAppSessionToken({
      userId: user.id,
      accountType: 'PATIENT',
      role: user.role,
      email: user.email || undefined,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        role: user.role,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register patient' },
      { status }
    );
  }
}
