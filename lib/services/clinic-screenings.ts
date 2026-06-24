import crypto from 'node:crypto';

import { ClinicScreeningSubmissionStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { assertAccessibleMember, ensureMemberForDevice } from '@/lib/assessment-skill/member-service';
import {
  evaluateScaleAnswers,
  getDoctorVisibleScaleById,
  getSerializableScaleById,
} from '@/lib/scales/catalog';
import { ensurePendingDoctorReviewForAssessment } from '@/lib/services/doctor-care';
import { resolveLocalizedText, resolveQuestionText } from '@/lib/schemas/core/i18n';

function memberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

function buildQrSlug() {
  return crypto.randomBytes(9).toString('base64url').toLowerCase();
}

function buildScreeningCode(now = new Date()) {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CLN-${stamp}-${time}-${suffix}`;
}

function buildPointCode(now = new Date()) {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `POINT-${stamp}-${suffix}`;
}

function normalizePointCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function serializeClinicResult(result: {
  totalScore: number;
  conclusion: string;
  details?: Record<string, unknown>;
}) {
  return JSON.parse(JSON.stringify(result));
}

function serializeAnswers(answers: number[]) {
  return JSON.parse(JSON.stringify(answers));
}

export async function listApprovedDoctorsForClinicAssignment() {
  return prisma.doctorProfile.findMany({
    where: {
      verificationStatus: 'APPROVED',
    },
    orderBy: [
      { hospitalName: 'asc' },
      { departmentName: 'asc' },
      { realName: 'asc' },
    ],
    select: {
      id: true,
      realName: true,
      hospitalName: true,
      departmentName: true,
      title: true,
    },
  });
}

export async function createClinicScreeningPoint(input: {
  name: string;
  code?: string;
  ownerDoctorProfileId: string;
  locationLabel?: string;
  departmentLabel?: string;
}) {
  const code = normalizePointCode(input.code || buildPointCode());
  if (!code) {
    throw new Error('Point code is required');
  }

  return prisma.clinicScreeningPoint.create({
    data: {
      name: input.name.trim(),
      code,
      ownerDoctorProfileId: input.ownerDoctorProfileId,
      locationLabel: input.locationLabel?.trim() || null,
      departmentLabel: input.departmentLabel?.trim() || null,
    },
    include: {
      ownerDoctorProfile: true,
    },
  });
}

export async function listDoctorOwnedClinicScreeningPoints(doctorProfileId: string) {
  return prisma.clinicScreeningPoint.findMany({
    where: {
      ownerDoctorProfileId: doctorProfileId,
    },
    orderBy: [
      { isActive: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      qrs: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          screenings: true,
        },
      },
    },
  });
}

export async function createDoctorOwnedClinicScreeningPoint(input: {
  doctorProfileId: string;
  name: string;
  code?: string;
  locationLabel?: string;
  departmentLabel?: string;
  defaultDepartmentLabel?: string;
}) {
  return createClinicScreeningPoint({
    name: input.name,
    code: input.code,
    ownerDoctorProfileId: input.doctorProfileId,
    locationLabel: input.locationLabel,
    departmentLabel: input.departmentLabel || input.defaultDepartmentLabel,
  });
}

export async function listClinicScreeningPoints() {
  return prisma.clinicScreeningPoint.findMany({
    orderBy: [
      { isActive: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      ownerDoctorProfile: true,
      qrs: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          screenings: true,
        },
      },
    },
  });
}

export async function createClinicScaleQr(input: {
  pointId: string;
  scaleId: string;
}) {
  const point = await prisma.clinicScreeningPoint.findUnique({
    where: { id: input.pointId },
    include: { ownerDoctorProfile: true },
  });

  if (!point) {
    throw new Error('Clinic screening point not found');
  }

  if (!point.isActive) {
    throw new Error('Clinic screening point is inactive');
  }

  const scale = getSerializableScaleById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  const existing = await prisma.clinicScaleQr.findFirst({
    where: {
      pointId: input.pointId,
      scaleId: input.scaleId,
      isActive: true,
    },
  });

  if (existing) {
    throw new Error('An active clinic QR already exists for this point and scale');
  }

  const qr = await prisma.clinicScaleQr.create({
    data: {
      pointId: input.pointId,
      scaleId: input.scaleId,
      slug: buildQrSlug(),
      isActive: true,
    },
    include: {
      point: {
        include: {
          ownerDoctorProfile: true,
        },
      },
    },
  });

  return {
    ...qr,
    scale,
  };
}

export async function listDoctorOwnedClinicScaleQrs(doctorProfileId: string) {
  const qrs = await prisma.clinicScaleQr.findMany({
    where: {
      point: {
        ownerDoctorProfileId: doctorProfileId,
      },
    },
    orderBy: [
      { isActive: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      point: true,
      _count: {
        select: {
          screenings: true,
        },
      },
    },
  });

  return qrs.map((qr) => ({
    ...qr,
    scale: getSerializableScaleById(qr.scaleId),
  }));
}

export async function createDoctorOwnedClinicScaleQr(input: {
  doctorProfileId: string;
  pointId: string;
  scaleId: string;
}) {
  const point = await prisma.clinicScreeningPoint.findFirst({
    where: {
      id: input.pointId,
      ownerDoctorProfileId: input.doctorProfileId,
    },
    select: { id: true },
  });

  if (!point) {
    throw new Error('Clinic screening point not found or not owned by current doctor');
  }

  const scale = getDoctorVisibleScaleById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  return createClinicScaleQr({
    pointId: input.pointId,
    scaleId: scale.id,
  });
}

export async function listClinicScaleQrs() {
  const qrs = await prisma.clinicScaleQr.findMany({
    orderBy: [
      { isActive: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      point: {
        include: {
          ownerDoctorProfile: true,
        },
      },
      _count: {
        select: {
          screenings: true,
        },
      },
    },
  });

  return qrs.map((qr) => ({
    ...qr,
    scale: getSerializableScaleById(qr.scaleId),
  }));
}

export async function updateClinicScaleQr(input: {
  id: string;
  isActive: boolean;
}) {
  return prisma.clinicScaleQr.update({
    where: { id: input.id },
    data: {
      isActive: input.isActive,
    },
    include: {
      point: {
        include: {
          ownerDoctorProfile: true,
        },
      },
    },
  });
}

export async function updateDoctorOwnedClinicScaleQr(input: {
  doctorProfileId: string;
  id: string;
  isActive: boolean;
}) {
  const qr = await prisma.clinicScaleQr.findFirst({
    where: {
      id: input.id,
      point: {
        ownerDoctorProfileId: input.doctorProfileId,
      },
    },
    select: { id: true },
  });

  if (!qr) {
    throw new Error('Clinic QR not found or not owned by current doctor');
  }

  return updateClinicScaleQr({
    id: input.id,
    isActive: input.isActive,
  });
}

export async function getClinicQrForPublic(slug: string) {
  const qr = await prisma.clinicScaleQr.findUnique({
    where: { slug },
    include: {
      point: {
        include: {
          ownerDoctorProfile: true,
        },
      },
    },
  });

  if (!qr || !qr.isActive || !qr.point.isActive) {
    throw new Error('Clinic QR is not available');
  }

  const scale = getSerializableScaleById(qr.scaleId);
  if (!scale) {
    throw new Error(`Scale ${qr.scaleId} not found`);
  }

  return {
    qr,
    scale,
  };
}

export async function submitClinicQrAssessment(input: {
  slug: string;
  guestSessionId: string;
  respondentName: string;
  respondentGender: 'boy' | 'girl';
  respondentAgeMonths: number;
  answers: number[];
}) {
  const { qr, scale } = await getClinicQrForPublic(input.slug);

  if (input.answers.length !== scale.questions.length) {
    throw new Error(`Expected ${scale.questions.length} answers, received ${input.answers.length}`);
  }

  const { user, member } = await ensureMemberForDevice({
    deviceId: input.guestSessionId,
    memberSnapshot: {
      nickname: input.respondentName,
      gender: input.respondentGender,
      ageMonths: input.respondentAgeMonths,
      relation: 'self',
      languagePreference: 'zh',
    },
  });

  const result = evaluateScaleAnswers(scale.id, input.answers);
  const screeningCode = buildScreeningCode();

  const [assessmentHistory, submission] = await prisma.$transaction(async (tx) => {
    const history = await tx.assessmentHistory.create({
      data: {
        userId: user.id,
        profileId: member.id,
        scaleId: scale.id,
        scaleVersion: scale.version || '1.0',
        totalScore: result.totalScore,
        conclusion: result.conclusion,
        answers: serializeAnswers(input.answers),
        resultDetails: result.details ? JSON.parse(JSON.stringify(result.details)) : undefined,
        source: 'CLINIC_QR',
        respondentRealName: input.respondentName,
        respondentGender: input.respondentGender,
        respondentAgeMonths: input.respondentAgeMonths,
      },
    });

    const createdSubmission = await tx.clinicScreeningSubmission.create({
      data: {
        screeningCode,
        clinicScaleQrId: qr.id,
        pointId: qr.pointId,
        doctorProfileId: qr.point.ownerDoctorProfileId,
        userId: user.id,
        memberProfileId: member.id,
        guestSessionId: input.guestSessionId,
        respondentName: input.respondentName,
        respondentGender: input.respondentGender,
        respondentAgeMonths: input.respondentAgeMonths,
        answers: serializeAnswers(input.answers),
        resultSummary: serializeClinicResult(result),
        assessmentHistoryId: history.id,
        status: ClinicScreeningSubmissionStatus.SUBMITTED,
      },
      include: {
        point: {
          include: {
            ownerDoctorProfile: true,
          },
        },
        clinicScaleQr: true,
      },
    });

    return [history, createdSubmission];
  });

  await ensurePendingDoctorReviewForAssessment({
    assessmentHistoryId: assessmentHistory.id,
    memberProfileId: member.id,
    doctorProfileId: qr.point.ownerDoctorProfileId,
  });

  return {
    screeningCode,
    submission,
    assessmentHistoryId: assessmentHistory.id,
    scale: {
      id: scale.id,
      title: scale.title,
    },
    result,
  };
}

export async function claimClinicScreeningsForGuestSession(input: {
  guestSessionId: string;
  userId: string;
}) {
  const [submissions, profiles] = await Promise.all([
    prisma.clinicScreeningSubmission.findMany({
      where: {
        guestSessionId: input.guestSessionId,
        status: ClinicScreeningSubmissionStatus.SUBMITTED,
      },
      select: {
        id: true,
        assessmentHistoryId: true,
      },
    }),
    memberProfileModel().findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ]);

  if (!submissions.length) {
    return { claimedCount: 0 };
  }

  const defaultMemberId = profiles.length === 1 ? profiles[0].id : null;

  await prisma.$transaction(async (tx) => {
    for (const submission of submissions) {
      if (submission.assessmentHistoryId) {
        await tx.assessmentHistory.update({
          where: { id: submission.assessmentHistoryId },
          data: {
            userId: input.userId,
            ...(defaultMemberId ? { profileId: defaultMemberId } : {}),
          },
        });
      }

      await tx.clinicScreeningSubmission.update({
        where: { id: submission.id },
        data: {
          userId: input.userId,
          ...(defaultMemberId ? { memberProfileId: defaultMemberId } : {}),
          status: ClinicScreeningSubmissionStatus.CLAIMED,
          claimedAt: new Date(),
        },
      });
    }
  });

  return { claimedCount: submissions.length };
}

export async function claimClinicScreening(input: {
  userId: string;
  screeningCode: string;
  memberId?: string;
}) {
  const submission = await prisma.clinicScreeningSubmission.findUnique({
    where: { screeningCode: input.screeningCode },
    include: {
      assessmentHistory: true,
    },
  });

  if (!submission) {
    throw new Error('Clinic screening submission not found');
  }

  const memberId = input.memberId
    ? (await assertAccessibleMember(input.userId, input.memberId)).id
    : null;

  await prisma.$transaction(async (tx) => {
    if (submission.assessmentHistoryId) {
      await tx.assessmentHistory.update({
        where: { id: submission.assessmentHistoryId },
        data: {
          userId: input.userId,
          ...(memberId ? { profileId: memberId } : {}),
        },
      });
    }

    await tx.clinicScreeningSubmission.update({
      where: { id: submission.id },
      data: {
        userId: input.userId,
        ...(memberId ? { memberProfileId: memberId } : {}),
        status: ClinicScreeningSubmissionStatus.CLAIMED,
        claimedAt: new Date(),
      },
    });
  });

  return { success: true };
}

function buildScreeningWhere(input: {
  pointId?: string;
  scaleId?: string;
  screeningCode?: string;
  respondentName?: string;
  status?: string;
  doctorProfileId?: string;
}) {
  return {
    ...(input.pointId ? { pointId: input.pointId } : {}),
    ...(input.scaleId ? { clinicScaleQr: { scaleId: input.scaleId } } : {}),
    ...(input.screeningCode
      ? {
          screeningCode: {
            contains: input.screeningCode,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(input.respondentName
      ? {
          respondentName: {
            contains: input.respondentName,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(input.status ? { status: input.status as ClinicScreeningSubmissionStatus } : {}),
    ...(input.doctorProfileId ? { doctorProfileId: input.doctorProfileId } : {}),
  };
}

function mapSubmissionListItem(item: any) {
  const resultSummary = (item.resultSummary as Record<string, any>) || {};
  return {
    id: item.id,
    screeningCode: item.screeningCode,
    respondentName: item.respondentName,
    respondentGender: item.respondentGender,
    respondentAgeMonths: item.respondentAgeMonths,
    status: item.status,
    claimedAt: item.claimedAt,
    createdAt: item.createdAt,
    userId: item.userId,
    memberProfileId: item.memberProfileId,
    point: {
      id: item.point.id,
      name: item.point.name,
      code: item.point.code,
      locationLabel: item.point.locationLabel,
    },
    doctor: {
      id: item.doctorProfile.id,
      realName: item.doctorProfile.realName,
      hospitalName: item.doctorProfile.hospitalName,
      departmentName: item.doctorProfile.departmentName,
      title: item.doctorProfile.title,
    },
    qr: {
      id: item.clinicScaleQr.id,
      scaleId: item.clinicScaleQr.scaleId,
      slug: item.clinicScaleQr.slug,
    },
    result: {
      totalScore: resultSummary.totalScore,
      conclusion: resultSummary.conclusion,
    },
  };
}

export async function listDoctorClinicScreenings(input: {
  doctorProfileId: string;
  pointId?: string;
  scaleId?: string;
  screeningCode?: string;
  respondentName?: string;
  status?: string;
}) {
  const screenings = await prisma.clinicScreeningSubmission.findMany({
    where: buildScreeningWhere({
      ...input,
      doctorProfileId: input.doctorProfileId,
    }),
    orderBy: { createdAt: 'desc' },
    include: {
      point: true,
      doctorProfile: true,
      clinicScaleQr: true,
    },
  });

  return screenings.map(mapSubmissionListItem);
}

export async function getDoctorClinicScreeningDetail(input: {
  doctorProfileId: string;
  submissionId: string;
}) {
  const submission = await prisma.clinicScreeningSubmission.findFirst({
    where: {
      id: input.submissionId,
      doctorProfileId: input.doctorProfileId,
    },
    include: {
      point: true,
      doctorProfile: true,
      clinicScaleQr: true,
      assessmentHistory: true,
      user: {
        select: {
          id: true,
          phone: true,
          email: true,
        },
      },
      memberProfile: {
        select: {
          id: true,
          nickname: true,
          realName: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error('Clinic screening submission not found');
  }

  const scale = getSerializableScaleById(submission.clinicScaleQr.scaleId);
  if (!scale) {
    throw new Error(`Scale ${submission.clinicScaleQr.scaleId} not found`);
  }

  const result = submission.assessmentHistory
    ? {
        totalScore: submission.assessmentHistory.totalScore,
        conclusion: submission.assessmentHistory.conclusion,
        details: (submission.assessmentHistory.resultDetails as Record<string, unknown> | null) || undefined,
      }
    : (submission.resultSummary as Record<string, any>);

  return {
    ...mapSubmissionListItem(submission),
    scale: {
      id: scale.id,
      title: resolveLocalizedText(scale.title, 'zh'),
      description: resolveLocalizedText(scale.description, 'zh'),
      questions: scale.questions.map((question) => ({
        id: question.id,
        text: resolveQuestionText(question, 'zh'),
        options: question.options.map((option) => ({
          label: option.label,
          score: option.score,
        })),
      })),
    },
    answers: submission.answers,
    resultSummary: result,
    assessmentHistoryId: submission.assessmentHistoryId,
    account: submission.user,
    claimedMember: submission.memberProfile,
  };
}

export async function getDoctorClinicScreeningReport(input: {
  doctorProfileId: string;
  submissionId: string;
}) {
  const submission = await prisma.clinicScreeningSubmission.findFirst({
    where: {
      id: input.submissionId,
      doctorProfileId: input.doctorProfileId,
    },
    include: {
      clinicScaleQr: true,
      assessmentHistory: true,
    },
  });

  if (!submission) {
    throw new Error('Clinic screening submission not found');
  }

  const scale = getSerializableScaleById(submission.clinicScaleQr.scaleId);
  if (!scale) {
    throw new Error(`Scale ${submission.clinicScaleQr.scaleId} not found`);
  }

  const answers = Array.isArray(submission.answers)
    ? submission.answers.map((value) => (typeof value === 'number' ? value : Number(value)))
    : [];

  const result = submission.assessmentHistory
    ? {
        totalScore: submission.assessmentHistory.totalScore,
        conclusion: submission.assessmentHistory.conclusion,
        details: (submission.assessmentHistory.resultDetails as Record<string, unknown> | null) || undefined,
      }
    : (submission.resultSummary as Record<string, any>);

  const answerDetails = scale.questions.map((question, index) => {
    const answerScore = typeof answers[index] === 'number' && Number.isFinite(answers[index]) ? answers[index] : null;
    const selectedOption =
      answerScore === null ? undefined : question.options.find((option) => option.score === answerScore);

    return {
      questionId: question.id,
      questionText: resolveQuestionText(question, 'zh'),
      answerScore,
      answerLabel: selectedOption?.label || (answerScore === null ? '未作答' : String(answerScore)),
    };
  });

  return {
    assessmentId: submission.assessmentHistoryId || submission.id,
    member: {
      nickname: submission.respondentName,
      relation: 'CLINIC_QR',
      gender: submission.respondentGender,
      ageMonths: submission.respondentAgeMonths,
    },
    scale: {
      id: scale.id,
      name: resolveLocalizedText(scale.title, 'zh'),
      version: scale.version || '1.0',
    },
    result,
    answerDetails,
    assessedAt: submission.createdAt.toISOString(),
    exportedAt: new Date().toISOString(),
  };
}

export async function listAdminClinicScreenings(input: {
  pointId?: string;
  scaleId?: string;
  screeningCode?: string;
  respondentName?: string;
  status?: string;
}) {
  const screenings = await prisma.clinicScreeningSubmission.findMany({
    where: buildScreeningWhere(input),
    orderBy: { createdAt: 'desc' },
    include: {
      point: true,
      doctorProfile: true,
      clinicScaleQr: true,
    },
  });

  return screenings.map(mapSubmissionListItem);
}
