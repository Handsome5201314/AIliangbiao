import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { prisma } from '@/lib/db/prisma';
import { AuthVerificationError, verifyVerificationCode } from '@/lib/services/authVerification';
import { claimClinicScreeningsForGuestSession } from '@/lib/services/clinic-screenings';
import { claimAllPendingMembersForUser, reconcilePendingMembersForUser } from '@/lib/services/member-archive';
import { findPatientUserForLogin } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(4),
  guestSessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const verified = await verifyVerificationCode({
      phone: body.phone,
      purpose: 'login',
      code: body.code,
    });

    let user = await findPatientUserForLogin(verified.phone);
    if (!user) {
      return NextResponse.json({ success: false, error: '该手机号尚未注册' }, { status: 404 });
    }

    if (body.guestSessionId && (user.phone || user.email)) {
      await QuotaManager.upgradeToRegisteredUser(
        body.guestSessionId,
        user.phone || undefined,
        user.email || undefined
      );

      const mergedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          doctorProfile: true,
        },
      });

      if (mergedUser) {
        user = mergedUser;
      }
    }

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
      doctorProfileId: user.doctorProfile?.id,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        accountType: 'PATIENT',
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
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof AuthVerificationError
          ? error.status
          : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '短信登录失败',
      },
      { status }
    );
  }
}
