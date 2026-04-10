import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';

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
    const { deviceId, phone, email, profile } = body;

    if (!deviceId || (!phone && !email)) {
      return NextResponse.json(
        { error: '缺少注册/登录必要参数' },
        { status: 400 }
      );
    }

    const user = await QuotaManager.upgradeToRegisteredUser(deviceId, phone, email);
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
          gender: profile.gender || 'boy',
          ageMonths: profile.ageMonths || null,
          traits: {
            interests: profile.interests || [],
            fears: profile.fears || [],
          },
          avatarConfig: profile.avatarState || {},
        },
      });
    }

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
