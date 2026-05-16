import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { claimClinicScreeningsForGuestSession } from '@/lib/services/clinic-screenings';
import { claimAllPendingMembersForUser, reconcilePendingMembersForUser } from '@/lib/services/member-archive';
import { createPatientAccount } from '@/lib/services/doctor-care';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

async function getMemberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

function mapProfile(profile: any, completedScales: string[]) {
  const traits = (profile.traits as any) || {};
  return {
    id: profile.id,
    relation: String(profile.relation || 'SELF').toLowerCase(),
    languagePreference: String(profile.languagePreference || 'ZH').toLowerCase(),
    nickname: profile.nickname,
    realName: profile.realName,
    contactPhone: profile.contactPhone,
    pendingClaim: profile.pendingClaim,
    gender: profile.gender,
    ageMonths: profile.ageMonths,
    interests: traits.interests || [],
    fears: traits.fears || [],
    avatarConfig: profile.avatarConfig,
    completedScales,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, guestSessionId, phone, email, password, profile } = body;
    const resolvedGuestSessionId = String(guestSessionId || deviceId || '').trim();
    const normalizedPhone = normalizeOptionalPhone(phone);

    if (!resolvedGuestSessionId || !normalizedPhone || !password) {
      return NextResponse.json(
        { error: '请填写手机号和密码后再升级账号' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await createPatientAccount({
      phone: normalizedPhone,
      email: email || undefined,
      passwordHash,
      deviceId: resolvedGuestSessionId,
    });

    await claimClinicScreeningsForGuestSession({
      guestSessionId: resolvedGuestSessionId,
      userId: user.id,
    });

    const memberProfileModel = await getMemberProfileModel();
    const existingProfiles = await memberProfileModel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    if (profile?.nickname && existingProfiles.length === 0) {
      await memberProfileModel.create({
        data: {
          userId: user.id,
          relation: String(profile.relation || 'SELF').toUpperCase(),
          languagePreference: String(profile.languagePreference || 'ZH').toUpperCase(),
          nickname: profile.nickname,
          realName: profile.realName || profile.nickname,
          contactPhone: normalizedPhone,
          gender: profile.gender || 'boy',
          ageMonths: profile.ageMonths || null,
          pendingClaim: false,
          traits: {
            interests: profile.interests || [],
            fears: profile.fears || [],
          },
          avatarConfig: profile.avatarState || {},
        },
      });
    }

    await reconcilePendingMembersForUser(user.id);
    await claimAllPendingMembersForUser(user.id);

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profiles: {
          orderBy: { createdAt: 'asc' },
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          select: { scaleId: true },
        },
      },
    });

    if (!freshUser) {
      return NextResponse.json({ error: '账号升级失败' }, { status: 500 });
    }

    const completedScales = Array.from(
      new Set<string>(
        (freshUser.assessments || [])
          .map((item) => String(item.scaleId))
          .filter((value: string) => Boolean(value))
      )
    );
    const profiles = freshUser.profiles.map((item) => mapProfile(item, completedScales));

    return NextResponse.json({
      success: true,
      user: {
        id: freshUser.id,
        role: freshUser.role || 'REGISTERED',
        isGuest: freshUser.isGuest,
        dailyLimit: freshUser.dailyLimit,
        dailyUsed: freshUser.dailyUsed,
        phone: freshUser.phone,
        email: freshUser.email,
      },
      activeProfileId: profiles[0]?.id || null,
      profiles,
    });
  } catch (error) {
    console.error('[Account Upgrade Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '账号升级失败' },
      { status: 500 }
    );
  }
}
