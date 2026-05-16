import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { prisma } from '@/lib/db/prisma';
import { claimClinicScreeningsForGuestSession } from '@/lib/services/clinic-screenings';
import { claimAllPendingMembersForUser, reconcilePendingMembersForUser } from '@/lib/services/member-archive';
import { findDoctorUserForLogin, findPatientUserForLogin } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  accountType: z.enum(['PATIENT', 'DOCTOR']).default('PATIENT'),
  identifier: z.string().min(1).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
  guestSessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const guestSessionId = body.guestSessionId?.trim() || body.deviceId?.trim() || undefined;
    const identifier =
      body.identifier?.trim() ||
      body.phone?.trim() ||
      body.email?.trim() ||
      '';

    if (!identifier) {
      return NextResponse.json(
        {
          success: false,
          error: body.accountType === 'DOCTOR' ? '请输入邮箱' : '请输入手机号或邮箱',
        },
        { status: 400 }
      );
    }

    let user =
      body.accountType === 'DOCTOR'
        ? await findDoctorUserForLogin(identifier)
        : await findPatientUserForLogin(identifier);

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: body.accountType === 'DOCTOR' ? '邮箱或密码错误' : '手机号/邮箱或密码错误',
        },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: body.accountType === 'DOCTOR' ? '邮箱或密码错误' : '手机号/邮箱或密码错误',
        },
        { status: 401 }
      );
    }

    if (body.accountType === 'DOCTOR' && !user.doctorProfile) {
      return NextResponse.json(
        {
          success: false,
          error: '该账号不是医生账号',
        },
        { status: 403 }
      );
    }

    if (body.accountType === 'PATIENT' && guestSessionId && (user.phone || user.email)) {
      await QuotaManager.upgradeToRegisteredUser(
        guestSessionId,
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

    if (body.accountType === 'PATIENT') {
      if (guestSessionId) {
        await claimClinicScreeningsForGuestSession({
          guestSessionId,
          userId: user.id,
        });
      }
      await reconcilePendingMembersForUser(user.id);
      await claimAllPendingMembersForUser(user.id);
    }

    const activeAccountType = body.accountType;

    const session = issueAppSessionToken({
      userId: user.id,
      accountType: activeAccountType,
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
        accountType: activeAccountType,
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
      {
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      },
      { status }
    );
  }
}
