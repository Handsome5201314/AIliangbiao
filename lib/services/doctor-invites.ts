import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { getSerializableScaleById, evaluateScaleAnswers } from '@/lib/scales/catalog';
import {
  createPendingMemberProfile,
  ensureDoctorCareAssignment,
  findUniqueMemberMatchForUser,
  normalizeMemberIdentity,
  type MemberIdentitySnapshotInput,
} from '@/lib/services/member-archive';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

function buildInviteToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function expireInviteIfNeeded(invite: any) {
  if (!invite || invite.status !== 'ACTIVE') {
    return invite;
  }

  if (invite.expiresAt.getTime() > Date.now()) {
    return invite;
  }

  return prisma.doctorScaleInvite.update({
    where: { id: invite.id },
    data: {
      status: 'EXPIRED',
    },
    include: {
      doctorProfile: true,
      linkedMember: true,
    },
  });
}

async function getInviteByToken(token: string) {
  const invite = await prisma.doctorScaleInvite.findUnique({
    where: { token },
    include: {
      doctorProfile: true,
      linkedMember: true,
    },
  });

  return expireInviteIfNeeded(invite);
}

export async function createDoctorScaleInvite(input: {
  doctorProfileId: string;
  scaleId: string;
}) {
  const scale = getSerializableScaleById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  const invite = await prisma.doctorScaleInvite.create({
    data: {
      doctorProfileId: input.doctorProfileId,
      token: buildInviteToken(),
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      status: 'ACTIVE',
    },
    include: {
      doctorProfile: true,
      linkedMember: true,
    },
  });

  return {
    ...invite,
    scale,
  };
}

export async function getDoctorScaleInvites(doctorProfileId: string) {
  const invites = await prisma.doctorScaleInvite.findMany({
    where: { doctorProfileId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      linkedMember: true,
    },
  });

  return Promise.all(
    invites.map(async (invite) => {
      const fresh = await expireInviteIfNeeded(invite);
      return {
        ...fresh,
        scale: getSerializableScaleById(fresh.scaleId),
      };
    })
  );
}

export async function getDoctorScaleInviteForPublic(token: string) {
  const invite = await getInviteByToken(token);
  if (!invite) {
    throw new Error('Invite not found');
  }

  const scale = getSerializableScaleById(invite.scaleId);
  if (!scale) {
    throw new Error(`Scale ${invite.scaleId} not found`);
  }

  return {
    invite,
    scale,
  };
}

function buildInviteDoctorName(doctorProfile: any) {
  return doctorProfile.realName || '医生';
}

async function resolveInviteMember(input: {
  user: any;
  identity: MemberIdentitySnapshotInput;
  doctorProfileId: string;
}) {
  const match = await findUniqueMemberMatchForUser({
    userId: input.user.id,
    identity: input.identity,
    inviteDoctorProfileId: input.doctorProfileId,
    includePending: true,
  });

  if (match.member) {
    const identity = normalizeMemberIdentity(input.identity);

    return prisma.memberProfile.update({
      where: { id: match.member.id },
      data: {
        nickname: match.member.nickname || identity.nickname,
        realName: match.member.realName || identity.realName,
        contactPhone: match.member.contactPhone || identity.contactPhone,
        gender: match.member.gender || identity.gender,
        ageMonths: match.member.ageMonths ?? identity.ageMonths,
        pendingClaim: input.user.isGuest ? true : match.member.pendingClaim,
      },
    });
  }

  return createPendingMemberProfile({
    userId: input.user.id,
    identity: input.identity,
  });
}

export async function submitDoctorScaleInvite(input: {
  token: string;
  deviceId: string;
  identity: MemberIdentitySnapshotInput;
  answers: number[];
}) {
  const inviteRecord = await getInviteByToken(input.token);
  if (!inviteRecord) {
    throw new Error('Invite not found');
  }

  if (inviteRecord.status !== 'ACTIVE') {
    throw new Error('Invite is no longer available');
  }

  const scale = getSerializableScaleById(inviteRecord.scaleId);
  if (!scale) {
    throw new Error(`Scale ${inviteRecord.scaleId} not found`);
  }

  if (input.answers.length !== scale.questions.length) {
    throw new Error(`Expected ${scale.questions.length} answers, received ${input.answers.length}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: (await QuotaManager.getOrCreateGuest(input.deviceId)).id },
    include: {
      profiles: true,
    },
  });

  if (!user) {
    throw new Error('Failed to resolve the submitting user');
  }

  const identity = normalizeMemberIdentity(input.identity);
  if (!identity.contactPhone) {
    throw new Error('手机号不能为空');
  }

  const member = await resolveInviteMember({
    user,
    identity,
    doctorProfileId: inviteRecord.doctorProfileId,
  });

  await ensureDoctorCareAssignment({
    memberId: member.id,
    doctorProfileId: inviteRecord.doctorProfileId,
    assignedByPatientUserId: user.id,
  });

  const result = evaluateScaleAnswers(scale.id, input.answers);

  const assessment = await prisma.$transaction(async (tx) => {
    const consumedInvite = await tx.doctorScaleInvite.updateMany({
      where: {
        id: inviteRecord.id,
        status: 'ACTIVE',
        usedAt: null,
      },
      data: {
        status: 'COMPLETED',
        usedAt: new Date(),
        linkedMemberId: member.id,
      },
    });

    if (consumedInvite.count !== 1) {
      throw new Error('Invite is no longer available');
    }

    return tx.assessmentHistory.create({
      data: {
        userId: user.id,
        profileId: member.id,
        scaleId: scale.id,
        scaleVersion: scale.version || '1.0',
        totalScore: result.totalScore,
        conclusion: result.conclusion,
        answers: JSON.parse(JSON.stringify(input.answers)),
        inviteId: inviteRecord.id,
        source: 'DOCTOR_INVITE',
        respondentRealName: identity.realName,
        respondentPhone: identity.contactPhone,
        respondentGender: identity.gender,
        respondentAgeMonths: identity.ageMonths,
      },
    });
  });

  const existingAccount = await prisma.user.findFirst({
    where: {
      phone: normalizeOptionalPhone(identity.contactPhone),
      isGuest: false,
      accountType: 'PATIENT',
    },
    select: { id: true },
  });

  return {
    invite: {
      id: inviteRecord.id,
      token: inviteRecord.token,
      doctorName: buildInviteDoctorName(inviteRecord.doctorProfile),
      scaleId: inviteRecord.scaleId,
    },
    member: {
      id: member.id,
      nickname: member.nickname,
      realName: member.realName,
      contactPhone: member.contactPhone,
      gender: member.gender,
      ageMonths: member.ageMonths,
      pendingClaim: member.pendingClaim,
    },
    assessment: {
      id: assessment.id,
      createdAt: assessment.createdAt,
    },
    result,
    nextAction: user.isGuest ? (existingAccount ? 'login' : 'register') : 'none',
  };
}
