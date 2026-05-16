import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { extractAppBearerToken, verifyAppSessionToken } from '@/lib/auth/app-session';
import { ensureMemberForDevice } from '@/lib/assessment-skill/member-service';

type MemberSnapshotInput = {
  nickname?: string;
  gender?: string;
  ageMonths?: number;
  relation?: string;
  languagePreference?: string;
  interests?: string[];
  fears?: string[];
  avatarConfig?: unknown;
};

function memberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

async function tryGetAuthenticatedUser(request: NextRequest) {
  try {
    const token = extractAppBearerToken(request);
    const session = verifyAppSessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: {
        doctorProfile: true,
        profiles: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      return null;
    }

    return { session, user };
  } catch {
    return null;
  }
}

function buildDefaultMemberInput(user: any, snapshot?: MemberSnapshotInput) {
  const nickname =
    snapshot?.nickname ||
    user.doctorProfile?.realName ||
    user.email?.split('@')[0] ||
    user.phone ||
    '本人';

  return {
    userId: user.id,
    relation: String(snapshot?.relation || 'SELF').toUpperCase(),
    languagePreference: String(snapshot?.languagePreference || 'ZH').toUpperCase(),
    nickname,
    realName: user.doctorProfile?.realName || nickname,
    contactPhone: user.phone || null,
    gender: snapshot?.gender || 'unknown',
    ageMonths: snapshot?.ageMonths || null,
    pendingClaim: false,
    traits: {
      interests: snapshot?.interests || [],
      fears: snapshot?.fears || [],
    },
    avatarConfig: snapshot?.avatarConfig || {},
  };
}

async function ensureMemberForAuthenticatedUser(input: {
  user: any;
  memberId?: string;
  memberSnapshot?: MemberSnapshotInput;
}) {
  const model = memberProfileModel();
  let profiles = await model.findMany({
    where: { userId: input.user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (!profiles.length) {
    const created = await model.create({
      data: buildDefaultMemberInput(input.user, input.memberSnapshot),
    });
    profiles = [created];
  }

  let member = profiles.find((item: any) => item.id === input.memberId) || profiles[0];

  if (!member && input.memberSnapshot) {
    member = await model.create({
      data: buildDefaultMemberInput(input.user, input.memberSnapshot),
    });
    profiles.push(member);
  }

  if (!member) {
    throw new Error('Failed to resolve authenticated member');
  }

  return {
    user: input.user,
    member,
    profiles,
  };
}

export async function resolveAgentSessionContext(input: {
  request: NextRequest;
  deviceId: string;
  memberId?: string;
  memberSnapshot?: MemberSnapshotInput;
}) {
  const authenticated = await tryGetAuthenticatedUser(input.request);
  if (authenticated) {
    const resolved = await ensureMemberForAuthenticatedUser({
      user: authenticated.user,
      memberId: input.memberId,
      memberSnapshot: input.memberSnapshot,
    });
    return {
      ...resolved,
      activeAccountType: authenticated.session.accountType,
    };
  }

  const guestContext = await ensureMemberForDevice({
    deviceId: input.deviceId,
    memberId: input.memberId,
    memberSnapshot: input.memberSnapshot,
  });

  const hydratedUser = await prisma.user.findUnique({
    where: { id: guestContext.user.id },
    include: {
      doctorProfile: true,
      profiles: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return {
    user: hydratedUser || { ...guestContext.user, doctorProfile: null, profiles: guestContext.profiles },
    member: guestContext.member,
    profiles: guestContext.profiles,
    activeAccountType: (hydratedUser?.accountType || 'PATIENT') as 'PATIENT' | 'DOCTOR',
  };
}

export function getAgentToolCapabilities(input: {
  accountType?: 'PATIENT' | 'DOCTOR';
  doctorProfileId?: string | null;
}) {
  const baseTools = [
    'assessment.recommend',
    'assessment.session.start',
    'assessment.session.answer',
    'assessment.session.cancel',
    'profile.read',
    'profile.export_v1',
    'profile.rebuild',
  ];

  if (input.accountType === 'DOCTOR' && input.doctorProfileId) {
    return [...baseTools, 'doctor.invites.create', 'doctor.invites.list'];
  }

  return baseTools;
}
