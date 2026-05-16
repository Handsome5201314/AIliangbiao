import { NextRequest, NextResponse } from 'next/server';

import { extractAppBearerToken, verifyAppSessionToken } from '@/lib/auth/app-session';
import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

type ServerMemberProfile = {
  id: string;
  relation: string;
  languagePreference: string;
  nickname: string;
  realName?: string;
  contactPhone?: string;
  pendingClaim?: boolean;
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
    realName: profile.realName || undefined,
    contactPhone: profile.contactPhone || undefined,
    pendingClaim: profile.pendingClaim ?? false,
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
  return prisma.user.findUnique({
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

async function loadAuthenticatedPatientWithProfiles(request: NextRequest) {
  try {
    const session = verifyAppSessionToken(extractAppBearerToken(request));
    let user = await prisma.user.findUnique({
      where: { id: session.sub },
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

    if (!user || user.accountType !== 'PATIENT') {
      return null;
    }

    if (!user.profiles.length) {
      const memberProfileModel = await getMemberProfileModel();
      const fallbackNickname = user.phone || user.email?.split('@')[0] || '本人';

      await memberProfileModel.create({
        data: {
          userId: user.id,
          relation: 'SELF',
          languagePreference: 'ZH',
          nickname: fallbackNickname,
          realName: fallbackNickname,
          contactPhone: user.phone || null,
          gender: 'unknown',
          ageMonths: null,
          pendingClaim: false,
          traits: {
            interests: [],
            fears: [],
          },
          avatarConfig: {},
        },
      });

      user = await prisma.user.findUnique({
        where: { id: session.sub },
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

    return user;
  } catch {
    return null;
  }
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
    const authenticatedUser = await loadAuthenticatedPatientWithProfiles(request);
    const body = await request.json();
    const {
      deviceId,
      memberId,
      relation,
      languagePreference,
      nickname,
      realName,
      contactPhone,
      gender,
      ageMonths,
      interests,
      fears,
      avatarConfig,
    } = body;

    if ((!authenticatedUser && !deviceId) || !nickname || !gender) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const user = authenticatedUser || await QuotaManager.getOrCreateGuest(deviceId);
    const memberProfileModel = await getMemberProfileModel();

    const profileData = {
      userId: user.id,
      relation: String(relation || 'SELF').toUpperCase(),
      languagePreference: String(languagePreference || 'ZH').toUpperCase(),
      nickname,
      realName: realName || null,
      contactPhone: normalizeOptionalPhone(contactPhone) || null,
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

    const freshUser = authenticatedUser
      ? await loadAuthenticatedPatientWithProfiles(request)
      : await loadUserWithProfiles(deviceId);
    if (!freshUser) {
      return NextResponse.json({ error: '同步用户画像失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...buildResponsePayload(freshUser),
    });
  } catch (error) {
    console.error('[Sync Profile Error]:', error);
    return NextResponse.json({ error: '同步用户画像失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedUser = await loadAuthenticatedPatientWithProfiles(request);
    if (authenticatedUser) {
      return NextResponse.json(buildResponsePayload(authenticatedUser));
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: '缺少 deviceId 参数' }, { status: 400 });
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
    return NextResponse.json({ error: '获取用户画像失败' }, { status: 500 });
  }
}
