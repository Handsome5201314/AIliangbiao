import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { AuthVerificationError, verifyVerificationCode } from '@/lib/services/authVerification';
import { claimClinicScreeningsForGuestSession } from '@/lib/services/clinic-screenings';
import { claimAllPendingMembersForUser, reconcilePendingMembersForUser } from '@/lib/services/member-archive';
import { createPatientAccount } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(4),
  password: z.string().min(8),
  guestSessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    await verifyVerificationCode({
      phone: body.phone,
      purpose: 'register',
      code: body.code,
    });

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await createPatientAccount({
      phone: body.phone,
      passwordHash,
      deviceId: body.guestSessionId?.trim() || undefined,
    });

    if (body.guestSessionId?.trim()) {
      await claimClinicScreeningsForGuestSession({
        guestSessionId: body.guestSessionId.trim(),
        userId: user.id,
      });
    }

    await reconcilePendingMembersForUser(user.id);
    await claimAllPendingMembersForUser(user.id);

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
        phone: user.phone,
        accountType: user.accountType,
        role: user.role,
      },
    });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof AuthVerificationError
          ? error.status
          : 500;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '患者短信注册失败' },
      { status }
    );
  }
}
