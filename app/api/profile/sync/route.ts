import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { NextRequest, NextResponse } from 'next/server';

type ServerMemberProfile = {
  id: string;
  relation: string;
  languagePreference: string;
  nickname: string;
  gender: string;
  ageMonths: number | null;
  interests: string[];
  fears: string[];
  avatarConfig: unknown;
  completedScales: string[];
};

function mapProfile(profile: any, completedScales: string[]): ServerMemberProfile {
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

async function getMemberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

async function loadUserWithProfiles(deviceId: string) {
  return await prisma.user.findUnique({
    where: { deviceId },
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
}

function buildResponsePayload(user: any) {
  const completedScales = Array.from(
    new Set<string>(
      (user.assessments || [])
        .map((item: any) => String(item.scaleId))
        .filter((value: string) => Boolean(value))
    )
  );
  const profiles = (user.profiles || []).map((profile: any) => mapProfile(profile, completedScales));
  return {
    user: {
      id: user.id,
      role: user.role || (user.isGuest ? 'GUEST' : 'REGISTERED'),
      isGuest: user.isGuest,
      phone: user.phone,
      email: user.email,
      dailyLimit: user.dailyLimit,
      dailyUsed: user.dailyUsed,
    },
    activeProfileId: profiles[0]?.id || null,
    profile: profiles[0] || null,
    profiles,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      deviceId,
      memberId,
      relation,
      languagePreference,
      nickname,
      gender,
      ageMonths,
      interests,
      fears,
      avatarConfig
    } = body;

    if (!deviceId || !nickname || !gender) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const user = await QuotaManager.getOrCreateGuest(deviceId);
    const memberProfileModel = await getMemberProfileModel();

    const profileData = {
      userId: user.id,
      relation: String(relation || 'SELF').toUpperCase(),
      languagePreference: String(languagePreference || 'ZH').toUpperCase(),
      nickname,
      gender,
      ageMonths: ageMonths || null,
      traits: {
        interests: interests || [],
        fears: fears || [],
      },
      avatarConfig: avatarConfig || {},
    };

    if (memberId) {
      const existingProfile = await memberProfileModel.findFirst({
        where: { id: memberId, userId: user.id },
      });

      if (existingProfile) {
        await memberProfileModel.update({
          where: { id: memberId },
          data: profileData,
        });
      } else {
        await memberProfileModel.create({
          data: profileData,
        });
      }
    } else {
      await memberProfileModel.create({
        data: profileData,
      });
    }

    const freshUser = await loadUserWithProfiles(deviceId);

    if (!freshUser) {
      return NextResponse.json({ error: '同步用户画像失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...buildResponsePayload(freshUser),
    });
  } catch (error) {
    console.error('[Sync Profile Error]:', error);
    return NextResponse.json(
      { error: '同步用户画像失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: '缺少deviceId参数' },
        { status: 400 }
      );
    }

    const user = await loadUserWithProfiles(deviceId);

    if (!user) {
      return NextResponse.json({
        user: {
          role: 'GUEST',
          isGuest: true,
          dailyLimit: 5,
          dailyUsed: 0,
          phone: null,
          email: null,
        },
        activeProfileId: null,
        profile: null,
        profiles: [],
      });
    }

    return NextResponse.json(buildResponsePayload(user));
  } catch (error) {
    console.error('[Get Profile Error]:', error);
    return NextResponse.json(
      { error: '获取用户画像失败' },
      { status: 500 }
    );
  }
}
