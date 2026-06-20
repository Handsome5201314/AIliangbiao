import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db/prisma';
import { getDoctorVisibleScaleById } from '@/lib/scales/catalog';
import {
  assertDoctorCanWriteMember,
  logPatientWriteAction,
} from '@/lib/services/care-teams';

export type MobileDoctorFillMode = 'doctor_assisted' | 'caregiver_handoff_locked';

const MOBILE_DOCTOR_CHANNELS = {
  doctor_assisted: 'mobile_h5_doctor_assisted',
  caregiver_handoff_locked: 'mobile_h5_caregiver_handoff',
} satisfies Record<MobileDoctorFillMode, string>;

function normalizeTemporaryGender(value: string) {
  return value === 'female' ? 'female' : 'male';
}

function formatAge(ageMonths?: number | null) {
  if (!Number.isFinite(ageMonths ?? NaN) || ageMonths === null || ageMonths === undefined) {
    return 'Age not provided';
  }
  if (ageMonths < 12) return `${ageMonths} months`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months ? `${years}y ${months}m` : `${years}y`;
}

function avatarForGender(gender: string) {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  return '童';
}

function toMobileDoctorPatient(member: {
  id: string;
  nickname: string;
  realName: string | null;
  gender: string;
  ageMonths: number | null;
  pendingClaim: boolean;
}) {
  const gender = member.gender === 'male' || member.gender === 'female' ? member.gender : 'unknown';
  return {
    id: member.id,
    name: member.nickname || member.realName || 'Temporary patient',
    age: member.ageMonths ?? 0,
    ageLabel: formatAge(member.ageMonths),
    gender,
    avatar: avatarForGender(gender),
    isTemporary: member.pendingClaim,
    latestAssessment: null,
  };
}

export async function createMobileTemporaryMember(input: {
  doctorProfileId: string;
  name: string;
  gender: 'male' | 'female';
  ageMonths: number;
  contact?: string;
  note?: string;
}) {
  const nickname = input.name.trim();
  if (!nickname) {
    throw new Error('Temporary patient name is required');
  }

  const deviceId = `doctor-mobile-temp:${input.doctorProfileId}:${crypto.randomUUID()}`;
  const member = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        role: 'GUEST',
        accountType: 'PATIENT',
        isGuest: true,
        deviceId,
        dailyLimit: 5,
        profiles: {
          create: {
            relation: 'CHILD',
            languagePreference: 'ZH',
            nickname,
            realName: nickname,
            contactPhone: input.contact?.trim() || null,
            gender: normalizeTemporaryGender(input.gender),
            ageMonths: input.ageMonths,
            pendingClaim: true,
            traits: {
              source: 'doctor_mobile_h5',
              note: input.note?.trim() || null,
            },
            avatarConfig: {
              source: 'doctor_mobile_h5',
            },
          },
        },
      },
      include: {
        profiles: true,
      },
    });
    const createdMember = user.profiles[0];
    if (!createdMember) {
      throw new Error('Temporary patient profile was not created');
    }

    await tx.careAssignment.create({
      data: {
        memberProfileId: createdMember.id,
        doctorProfileId: input.doctorProfileId,
        assignedByPatientUserId: user.id,
        status: 'ACTIVE',
      },
    });

    return createdMember;
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: member.id,
    action: 'DOCTOR_MOBILE_TEMP_MEMBER_CREATED',
    metadata: {
      source: 'mobile_h5',
    },
  });

  return toMobileDoctorPatient(member);
}

export async function createMobileClinicAssessmentSession(input: {
  doctorProfileId: string;
  memberId: string;
  scaleId: string;
  fillMode: MobileDoctorFillMode;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);

  const member = await prisma.memberProfile.findUnique({
    where: { id: input.memberId },
    select: { id: true, userId: true },
  });
  if (!member) {
    throw new Error('Patient member not found');
  }

  const scale = getDoctorVisibleScaleById(input.scaleId);
  if (!scale) {
    throw new Error('Scale is not available for doctor mobile assessment');
  }

  const session = await prisma.assessmentSession.create({
    data: {
      userId: member.userId,
      profileId: member.id,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      channel: MOBILE_DOCTOR_CHANNELS[input.fillMode],
      language: 'ZH',
      status: input.fillMode === 'caregiver_handoff_locked' ? 'HANDOFF_READY' : 'ONGOING',
      answers: [],
      currentQuestionIndex: 0,
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: member.id,
    action: 'DOCTOR_MOBILE_ASSESSMENT_SESSION_CREATED',
    metadata: {
      sessionId: session.id,
      scaleId: scale.id,
      fillMode: input.fillMode,
    },
  });

  return {
    sessionId: session.id,
    success: true as const,
  };
}

async function getWritableMobileSession(input: {
  doctorProfileId: string;
  sessionId: string;
}) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      profileId: true,
      channel: true,
      status: true,
    },
  });

  if (!session || !session.profileId) {
    throw new Error('Mobile assessment session not found');
  }

  if (!Object.values(MOBILE_DOCTOR_CHANNELS).includes(session.channel || '')) {
    throw new Error('Assessment session is not a mobile doctor session');
  }

  await assertDoctorCanWriteMember(session.profileId, input.doctorProfileId);
  return {
    ...session,
    profileId: session.profileId,
  };
}

export async function lockMobileClinicAssessmentSession(input: {
  doctorProfileId: string;
  sessionId: string;
}) {
  const session = await getWritableMobileSession(input);
  if (session.channel !== MOBILE_DOCTOR_CHANNELS.caregiver_handoff_locked) {
    throw new Error('Only caregiver handoff sessions can be locked');
  }

  const updated = await prisma.assessmentSession.update({
    where: { id: session.id },
    data: {
      status: 'HANDOFF_LOCKED',
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: session.profileId,
    action: 'DOCTOR_MOBILE_HANDOFF_LOCKED',
    metadata: {
      sessionId: session.id,
    },
  });

  return {
    success: true as const,
    lockedAt: updated.updatedAt.getTime(),
  };
}

export async function verifyMobileDoctorReauth(input: {
  doctorUserId: string;
  doctorProfileId: string;
  pin: string;
  sessionId?: string;
}) {
  if (!/^\d{6}$/.test(input.pin)) {
    throw new Error('Doctor PIN must be 6 digits');
  }

  const doctorUser = await prisma.user.findUnique({
    where: { id: input.doctorUserId },
    select: { passwordHash: true },
  });
  if (!doctorUser?.passwordHash) {
    throw new Error('Doctor account does not have a password credential');
  }

  const isValid = await bcrypt.compare(input.pin, doctorUser.passwordHash);
  if (!isValid) {
    throw new Error('Doctor PIN verification failed');
  }

  if (input.sessionId) {
    const session = await getWritableMobileSession({
      doctorProfileId: input.doctorProfileId,
      sessionId: input.sessionId,
    });

    await prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        status: 'DOCTOR_REAUTHENTICATED',
      },
    });

    await logPatientWriteAction({
      actorDoctorProfileId: input.doctorProfileId,
      memberId: session.profileId,
      action: 'DOCTOR_MOBILE_REAUTHENTICATED',
      metadata: {
        sessionId: session.id,
      },
    });
  }

  return { success: true as const };
}
