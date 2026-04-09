import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

import { upgradeGuestToPatientAccount } from '@/lib/auth/account-service';
import { attachUserSessionCookie } from '@/lib/auth/user-session';
import { memberProfileModel } from '@/lib/domain/member-profile';

function mapProfile(profile: any, completedScales: string[]) {
  const traits = (profile.traits as any) || {};
  return {
    id: profile.id,
    relation: String(profile.relation || 'SELF').toLowerCase(),
    languagePreference: String(profile.languagePreference || 'ZH').toLowerCase(),
    nickname: profile.nickname,
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
    const { deviceId, email, password, consentAccepted, consentVersion, profile } = body;

    if (!deviceId || !email || !password) {
      return NextResponse.json({ error: '缺少注册必要参数' }, { status: 400 });
    }

    const user = await upgradeGuestToPatientAccount({
      deviceId,
      email,
      password,
      consentAccepted,
      consentVersion,
      request,
      profile,
    });

    const model = memberProfileModel();
    const profiles = await model.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    const assessments = await prisma.assessmentHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { scaleId: true },
    });

    const completedScales = Array.from(
      new Set<string>(assessments.map((item) => String(item.scaleId)).filter(Boolean))
    );
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        role: user.role || 'REGISTERED',
        accountType: user.accountType || 'PATIENT',
        isGuest: user.isGuest,
        dailyLimit: user.dailyLimit,
        dailyUsed: user.dailyUsed,
        email: user.email,
        phone: user.phone,
      },
      activeProfileId: profiles[0]?.id || null,
      profiles: profiles.map((item: any) => mapProfile(item, completedScales)),
    });

    attachUserSessionCookie(response, {
      userId: user.id,
      accountType: 'PATIENT',
    });

    return response;
  } catch (error) {
    console.error('[Account Upgrade Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '账号升级失败' },
      { status: 500 }
    );
  }
}
