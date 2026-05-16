import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

export interface MemberIdentitySnapshotInput {
  realName: string;
  contactPhone: string;
  gender: string;
  ageMonths: number;
  nickname?: string;
}

function memberProfileModel(db: PrismaExecutor) {
  return (db as any).memberProfile ?? (db as any).childProfile;
}

function normalizeName(value: string) {
  return value.trim();
}

function normalizeGender(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAgeMonths(value: number) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function ageToleranceMonths(ageMonths: number) {
  return ageMonths <= 216 ? 3 : 12;
}

function agesMatch(left: number | null | undefined, right: number | null | undefined) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  const tolerance = Math.max(ageToleranceMonths(left), ageToleranceMonths(right));
  return Math.abs(left - right) <= tolerance;
}

export function normalizeMemberIdentity(input: MemberIdentitySnapshotInput) {
  return {
    realName: normalizeName(input.realName),
    contactPhone: normalizeOptionalPhone(input.contactPhone) || '',
    gender: normalizeGender(input.gender),
    ageMonths: normalizeAgeMonths(input.ageMonths),
    nickname: input.nickname?.trim() || normalizeName(input.realName),
  };
}

async function loadActiveCareAssignment(db: PrismaExecutor, memberId: string) {
  return (db as any).careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function findUniqueMemberMatchForUser(input: {
  userId: string;
  identity: MemberIdentitySnapshotInput;
  excludeMemberId?: string;
  includePending?: boolean;
  inviteDoctorProfileId?: string;
}) {
  const identity = normalizeMemberIdentity(input.identity);
  if (!identity.contactPhone) {
    return { member: null as any, reason: 'missing_phone' as const };
  }

  const profiles = await memberProfileModel(prisma).findMany({
    where: {
      userId: input.userId,
      contactPhone: identity.contactPhone,
      id: input.excludeMemberId ? { not: input.excludeMemberId } : undefined,
    },
    include: {
      careAssignments: {
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const matches = profiles.filter((profile: any) => {
    if (!input.includePending && profile.pendingClaim) {
      return false;
    }

    return (
      normalizeName(profile.realName || '') === identity.realName &&
      normalizeGender(profile.gender || '') === identity.gender &&
      agesMatch(profile.ageMonths, identity.ageMonths)
    );
  });

  if (matches.length !== 1) {
    return {
      member: null as any,
      reason: matches.length > 1 ? ('multiple_matches' as const) : ('no_match' as const),
    };
  }

  const [member] = matches;
  const activeAssignment = member.careAssignments?.[0];

  if (
    input.inviteDoctorProfileId &&
    activeAssignment &&
    activeAssignment.doctorProfileId !== input.inviteDoctorProfileId
  ) {
    return {
      member: null as any,
      reason: 'doctor_conflict' as const,
    };
  }

  return {
    member,
    reason: 'matched' as const,
  };
}

export async function ensureDoctorCareAssignment(input: {
  db?: PrismaExecutor;
  memberId: string;
  doctorProfileId: string;
  assignedByPatientUserId: string;
}) {
  const db = input.db || prisma;
  const activeAssignment = await loadActiveCareAssignment(db, input.memberId);

  if (activeAssignment) {
    if (activeAssignment.doctorProfileId !== input.doctorProfileId) {
      throw new Error('Member is already assigned to another doctor');
    }

    return activeAssignment;
  }

  return (db as any).careAssignment.create({
    data: {
      memberProfileId: input.memberId,
      doctorProfileId: input.doctorProfileId,
      assignedByPatientUserId: input.assignedByPatientUserId,
      status: 'ACTIVE',
    },
  });
}

export async function createPendingMemberProfile(input: {
  db?: PrismaExecutor;
  userId: string;
  identity: MemberIdentitySnapshotInput;
}) {
  const db = input.db || prisma;
  const identity = normalizeMemberIdentity(input.identity);

  return memberProfileModel(db).create({
    data: {
      userId: input.userId,
      relation: 'OTHER',
      languagePreference: 'ZH',
      nickname: identity.nickname,
      realName: identity.realName,
      contactPhone: identity.contactPhone,
      gender: identity.gender,
      ageMonths: identity.ageMonths,
      pendingClaim: true,
      traits: {
        interests: [],
        fears: [],
      },
      avatarConfig: {},
    },
  });
}

export async function moveInviteLinkedRecords(input: {
  tx: PrismaExecutor;
  sourceMemberId: string;
  targetMemberId: string;
}) {
  const tx = input.tx as any;

  await tx.assessmentHistory.updateMany({
    where: { profileId: input.sourceMemberId },
    data: { profileId: input.targetMemberId },
  });

  await tx.assessmentSession.updateMany({
    where: { profileId: input.sourceMemberId },
    data: { profileId: input.targetMemberId },
  });

  await tx.doctorPatientNote.updateMany({
    where: { memberProfileId: input.sourceMemberId },
    data: { memberProfileId: input.targetMemberId },
  });

  await tx.researchExportLog.updateMany({
    where: { memberProfileId: input.sourceMemberId },
    data: { memberProfileId: input.targetMemberId },
  });

  await tx.growthRecord.updateMany({
    where: { profileId: input.sourceMemberId },
    data: { profileId: input.targetMemberId },
  });

  await tx.doctorScaleInvite.updateMany({
    where: { linkedMemberId: input.sourceMemberId },
    data: { linkedMemberId: input.targetMemberId },
  });
}

export async function mergePendingMemberIntoTarget(input: {
  tx: PrismaExecutor;
  sourceMemberId: string;
  targetMemberId: string;
}) {
  const tx = input.tx as any;
  const model = memberProfileModel(tx);

  const [source, target] = await Promise.all([
    model.findUnique({
      where: { id: input.sourceMemberId },
      include: {
        careAssignments: true,
        researchConsent: true,
      },
    }),
    model.findUnique({
      where: { id: input.targetMemberId },
      include: {
        careAssignments: true,
        researchConsent: true,
      },
    }),
  ]);

  if (!source || !target) {
    throw new Error('Member profile not found during merge');
  }

  const sourceActive = source.careAssignments.find((item: any) => item.status === 'ACTIVE');
  const targetActive = target.careAssignments.find((item: any) => item.status === 'ACTIVE');

  if (
    sourceActive &&
    targetActive &&
    sourceActive.doctorProfileId !== targetActive.doctorProfileId
  ) {
    throw new Error('Pending member cannot be merged because active doctors conflict');
  }

  await moveInviteLinkedRecords({
    tx,
    sourceMemberId: source.id,
    targetMemberId: target.id,
  });

  if (source.researchConsent) {
    if (target.researchConsent) {
      await tx.researchConsent.delete({
        where: { memberProfileId: source.id },
      });
    } else {
      await tx.researchConsent.update({
        where: { memberProfileId: source.id },
        data: { memberProfileId: target.id },
      });
    }
  }

  await tx.careAssignment.updateMany({
    where: {
      memberProfileId: source.id,
      status: { not: 'ACTIVE' },
    },
    data: {
      memberProfileId: target.id,
    },
  });

  if (sourceActive) {
    if (!targetActive) {
      await tx.careAssignment.updateMany({
        where: {
          memberProfileId: source.id,
          status: 'ACTIVE',
        },
        data: {
          memberProfileId: target.id,
        },
      });
    } else {
      await tx.careAssignment.updateMany({
        where: {
          memberProfileId: source.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          endedAt: new Date(),
        },
      });
    }
  }

  await model.update({
    where: { id: target.id },
    data: {
      nickname: target.nickname || source.nickname,
      realName: target.realName || source.realName,
      contactPhone: target.contactPhone || source.contactPhone,
      gender: target.gender || source.gender,
      ageMonths: target.ageMonths ?? source.ageMonths,
      pendingClaim: false,
    },
  });

  await model.delete({
    where: { id: source.id },
  });
}

export async function reconcilePendingMembersForUser(userId: string) {
  const model = memberProfileModel(prisma);
  const pendingMembers = await model.findMany({
    where: {
      userId,
      pendingClaim: true,
      contactPhone: { not: null },
      realName: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  });

  let mergedCount = 0;

  for (const pendingMember of pendingMembers) {
    const match = await findUniqueMemberMatchForUser({
      userId,
      identity: {
        realName: pendingMember.realName,
        contactPhone: pendingMember.contactPhone,
        gender: pendingMember.gender,
        ageMonths: pendingMember.ageMonths ?? 0,
        nickname: pendingMember.nickname,
      },
      excludeMemberId: pendingMember.id,
      includePending: false,
    });

    if (!match.member) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await mergePendingMemberIntoTarget({
        tx,
        sourceMemberId: pendingMember.id,
        targetMemberId: match.member.id,
      });
    });

    mergedCount += 1;
  }

  return {
    mergedCount,
  };
}

export async function claimAllPendingMembersForUser(userId: string) {
  const result = await memberProfileModel(prisma).updateMany({
    where: {
      userId,
      pendingClaim: true,
    },
    data: {
      pendingClaim: false,
    },
  });

  return {
    claimedCount: result.count,
  };
}
