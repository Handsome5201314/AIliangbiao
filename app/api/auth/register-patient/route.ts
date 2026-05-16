import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { claimClinicScreeningsForGuestSession } from '@/lib/services/clinic-screenings';
import { claimAllPendingMembersForUser, reconcilePendingMembersForUser } from '@/lib/services/member-archive';
import { createPatientAccount } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  phone: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(8),
  deviceId: z.string().optional(),
  guestSessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 10);
    const guestSessionId = body.guestSessionId?.trim() || body.deviceId?.trim() || undefined;

    const user = await createPatientAccount({
      phone: body.phone,
      email: body.email,
      passwordHash,
      deviceId: guestSessionId,
    });

    if (guestSessionId) {
      await claimClinicScreeningsForGuestSession({
        guestSessionId,
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
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '患者注册失败',
      },
      { status }
    );
  }
}
