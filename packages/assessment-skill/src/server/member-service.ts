import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';

type TraitsShape = {
  interests?: string[];
  fears?: string[];
  behaviors?: string[];
  medicalHistory?: string[];
  agentNotes?: Array<{
    note: string;
    source: string;
    createdAt: string;
  }>;
};

function memberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

function mapTraits(traits: unknown): TraitsShape {
  const next = (traits as TraitsShape) || {};
  return {
    interests: next.interests || [],
    fears: next.fears || [],
    behaviors: next.behaviors || [],
    medicalHistory: next.medicalHistory || [],
    agentNotes: next.agentNotes || [],
  };
}

export async function resolveUserByDeviceId(deviceId: string) {
  const user = await QuotaManager.getOrCreateGuest(deviceId);
  return await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      profiles: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function ensureMemberForDevice(input: {
  deviceId: string;
  memberId?: string;
  memberSnapshot?: {
    nickname?: string;
    gender?: string;
    ageMonths?: number;
    relation?: string;
    languagePreference?: string;
    interests?: string[];
    fears?: string[];
    avatarConfig?: unknown;
  };
}) {
  const user = await QuotaManager.getOrCreateGuest(input.deviceId);
  const model = memberProfileModel();

  let profiles = await model.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (!profiles.length) {
    const snapshot = input.memberSnapshot;
    if (!snapshot?.nickname || !snapshot.gender) {
      throw new Error('No member profile is available for this device');
    }

    const created = await model.create({
      data: {
        userId: user.id,
        relation: String(snapshot.relation || 'SELF').toUpperCase(),
        languagePreference: String(snapshot.languagePreference || 'ZH').toUpperCase(),
        nickname: snapshot.nickname,
        gender: snapshot.gender,
        ageMonths: snapshot.ageMonths || null,
        traits: {
          interests: snapshot.interests || [],
          fears: snapshot.fears || [],
        },
        avatarConfig: snapshot.avatarConfig || {},
      },
    });
    profiles = [created];
  }

  const selectedProfile =
    profiles.find((item: any) => item.id === input.memberId) ||
    profiles[0];

  if (!selectedProfile) {
    throw new Error('Failed to resolve member profile');
  }

  return {
    user,
    member: selectedProfile,
    profiles,
  };
}

export async function listAccessibleMembers(userId: string) {
  const profiles = await memberProfileModel().findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return profiles.map((profile: any) => {
    const traits = mapTraits(profile.traits);
    return {
      id: profile.id,
      relation: String(profile.relation || 'SELF').toLowerCase(),
      languagePreference: String(profile.languagePreference || 'ZH').toLowerCase(),
      nickname: profile.nickname,
      gender: profile.gender,
      ageMonths: profile.ageMonths,
      interests: traits.interests,
      fears: traits.fears,
      behaviors: traits.behaviors,
    };
  });
}

export async function assertAccessibleMember(userId: string, memberId: string) {
  const member = await memberProfileModel().findFirst({
    where: {
      id: memberId,
      userId,
    },
  });

  if (!member) {
    throw new Error('Member not found or not accessible');
  }

  return member;
}

function assessmentFilterForMember(memberId: string, profileCount: number) {
  return profileCount === 1
    ? {
        OR: [
          { profileId: memberId },
          { profileId: null },
        ],
      }
    : { profileId: memberId };
}

export async function getMemberContext(userId: string, memberId: string) {
  const member = await assertAccessibleMember(userId, memberId);
  const profiles = await memberProfileModel().findMany({ where: { userId } });
  const traits = mapTraits(member.traits);

  const latestAssessment = await prisma.assessmentHistory.findFirst({
    where: {
      userId,
      ...assessmentFilterForMember(memberId, profiles.length),
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    member: {
      id: member.id,
      nickname: member.nickname,
      relation: String(member.relation || 'SELF').toLowerCase(),
      languagePreference: String(member.languagePreference || 'ZH').toLowerCase(),
      gender: member.gender,
      ageMonths: member.ageMonths,
      interests: traits.interests,
      fears: traits.fears,
      behaviors: traits.behaviors,
      medicalHistory: traits.medicalHistory,
    },
    latestAssessment: latestAssessment
      ? {
          scaleId: latestAssessment.scaleId,
          totalScore: latestAssessment.totalScore,
          conclusion: latestAssessment.conclusion,
          createdAt: latestAssessment.createdAt,
        }
      : null,
  };
}

export async function getMemberAssessmentSummary(userId: string, memberId: string) {
  const profiles = await memberProfileModel().findMany({ where: { userId } });
  await assertAccessibleMember(userId, memberId);

  const assessments = await prisma.assessmentHistory.findMany({
    where: {
      userId,
      ...assessmentFilterForMember(memberId, profiles.length),
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      scaleId: true,
      scaleVersion: true,
      totalScore: true,
      conclusion: true,
      createdAt: true,
    },
  });

  return {
    total: assessments.length,
    items: assessments,
  };
}

export async function getMemberMemorySummary(userId: string, memberId: string) {
  const member = await assertAccessibleMember(userId, memberId);
  const traits = mapTraits(member.traits);

  return {
    interests: traits.interests,
    fears: traits.fears,
    behaviors: traits.behaviors,
    medicalHistory: traits.medicalHistory,
    agentNotes: traits.agentNotes?.slice(-10) || [],
  };
}

export async function appendMemberMemoryNote(input: {
  userId: string;
  memberId: string;
  note: string;
  source: string;
}) {
  const member = await assertAccessibleMember(input.userId, input.memberId);
  const traits = mapTraits(member.traits);

  const nextNotes = [
    ...(traits.agentNotes || []),
    {
      note: input.note,
      source: input.source,
      createdAt: new Date().toISOString(),
    },
  ].slice(-20);

  const nextTraits = {
    ...traits,
    agentNotes: nextNotes,
  };

  await memberProfileModel().update({
    where: { id: member.id },
    data: { traits: nextTraits },
  });

  return {
    success: true,
    notesCount: nextNotes.length,
  };
}
