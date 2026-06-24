import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { resolveUserByDeviceId } from '@/lib/assessment-skill/member-service';
import {
  getDoctorVisibleScaleById,
  getScaleDefinitionById,
  evaluateScaleAnswers,
} from '@/lib/scales/catalog';
import { resolveLocalizedText, resolveQuestionText } from '@/lib/schemas/core/i18n';
import { looksLikeEmail, normalizeOptionalPhone } from '@/lib/utils/contact';
import {
  type AssessmentReportAnswerRow,
  type AssessmentReportSnapshot,
  buildAssessmentReportNo,
  buildAssessmentReportSnapshot,
  resolveAssessmentReportTemplateConfig,
} from '@/lib/utils/assessmentReportTemplate';
import {
  assertDoctorCanAccessMember,
  assertDoctorCanWriteMember,
  assertDoctorOwnsMember,
  assertDoctorProfileBoundaryChangeAllowed,
  listAccessibleMemberRoles,
  logPatientWriteAction,
} from '@/lib/services/care-teams';
import { createResearchSubjectId } from '@/lib/services/research-export';

type DoctorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
type DoctorStatusFilter = DoctorStatus | 'ALL';
type DoctorReviewDecisionStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO';
type DoctorReviewQueueStatus = 'PENDING' | 'IN_REVIEW' | 'NEEDS_MORE_INFO' | 'APPROVED' | 'REJECTED' | 'ALL';
type DoctorPatientAssessmentMode = 'doctor_assisted' | 'caregiver_handoff';
type TimelineDoctorReview = {
  id: string;
  status: string;
  reviewConclusion: string | null;
  reviewNotes: string | null;
  allowParentVisible: boolean;
  completedAt: Date | null;
};
type AssessmentTimelineRecord = {
  id: string;
  createdAt: Date;
  scaleId: string;
  totalScore: number;
  conclusion: string;
  source: string | null;
  respondentRealName: string | null;
  respondentPhone: string | null;
  respondentGender: string | null;
  respondentAgeMonths: number | null;
  doctorReviews: TimelineDoctorReview[];
};
type PendingAssessmentRecord = {
  id: string;
  profileId: string | null;
  scaleId: string;
};
type DoctorReviewRecord = TimelineDoctorReview & {
  startedAt: Date | null;
  durationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
  assessmentHistoryId: string | null;
  assessmentSessionId: string | null;
  memberProfileId: string | null;
  doctorProfileId: string;
  assessmentHistory?: {
    id: string;
    scaleId: string;
    scaleVersion?: string | null;
    totalScore: number;
    conclusion: string;
    answers?: unknown;
    resultDetails?: unknown;
    createdAt: Date;
    profileId?: string | null;
  } | null;
  assessmentSession?: {
    id: string;
    scaleId: string;
    status: string;
    completedAt: Date | null;
  } | null;
  memberProfile?: {
    id: string;
    nickname: string;
    realName: string | null;
    contactPhone: string | null;
    gender: string;
    ageMonths: number | null;
  } | null;
  doctorProfile?: {
    id: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  } | null;
};
type DoctorReviewDelegate = {
  count(args: unknown): Promise<number>;
  findFirst(args: unknown): Promise<DoctorReviewRecord | null>;
  findMany(args: unknown): Promise<DoctorReviewRecord[]>;
  findUnique(args: unknown): Promise<DoctorReviewRecord | null>;
  create(args: unknown): Promise<DoctorReviewRecord>;
  update(args: unknown): Promise<DoctorReviewRecord>;
};
type AssessmentReportDelegate = {
  findFirst(args: unknown): Promise<AssessmentReportRecord | null>;
  create(args: unknown): Promise<AssessmentReportRecord>;
  update(args: unknown): Promise<AssessmentReportRecord>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type ReportTemplateRecord = {
  id: string;
  name: string;
  templateVersion: string;
  hospitalName: string;
  departmentName: string | null;
  logoUrl: string | null;
  scaleIds: unknown;
  status: string;
  isDefault: boolean;
};
type ReportTemplateDelegate = {
  findFirst(args: unknown): Promise<ReportTemplateRecord | null>;
  create(args: unknown): Promise<ReportTemplateRecord>;
};
type AssessmentReportRecord = {
  id: string;
  reportNo: string;
  assessmentHistoryId: string | null;
  assessmentSessionId: string | null;
  memberProfileId: string | null;
  doctorReviewId: string;
  templateId: string;
  scaleId: string;
  reportStatus: string;
  reportSnapshot: unknown;
  parentVisible: boolean;
  approvedAt: Date | null;
};
type Phase1AssessmentHistoryDelegate = {
  findMany(args: unknown): Promise<AssessmentTimelineRecord[]>;
  findUnique(args: unknown): Promise<PendingAssessmentRecord | null>;
  findFirst(args: unknown): Promise<PendingAssessmentRecord | null>;
};
type Phase1PrismaAccess = typeof prisma & {
  doctorReview: DoctorReviewDelegate;
  assessmentReport: AssessmentReportDelegate;
  reportTemplate: ReportTemplateDelegate;
  assessmentHistory: Phase1AssessmentHistoryDelegate;
};

const DOCTOR_PATIENT_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

export class PatientReportVisibilityError extends Error {
  readonly statusCode = 403;
  readonly code = 'PENDING_DOCTOR_REVIEW';

  constructor(message = '等待医生复核后可查看报告') {
    super(message);
    this.name = 'PatientReportVisibilityError';
  }
}

function buildPublicAssessmentToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function isPhysicianReviewScale(scaleId: string) {
  const scale = getScaleDefinitionById(scaleId);
  return scale?.resultDeliveryMode === 'physician_review';
}

function canGenerateHandoffLink(scale: { interactionMode?: string }) {
  return scale.interactionMode === 'web_handoff';
}

function serializeJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function dbWithPhase1Models(tx: unknown = prisma) {
  return tx as Phase1PrismaAccess;
}

function getDoctorReviewModel(tx: unknown = prisma) {
  return dbWithPhase1Models(tx).doctorReview;
}

function getAssessmentReportModel(tx: unknown = prisma) {
  return dbWithPhase1Models(tx).assessmentReport;
}

function getReportTemplateModel(tx: unknown = prisma) {
  return dbWithPhase1Models(tx).reportTemplate;
}

function normalizeNullableText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type AssessmentReportSourceRecord = {
  id: string;
  userId?: string;
  profileId: string | null;
  scaleId: string;
  scaleVersion: string | null;
  totalScore: number;
  conclusion: string;
  answers: unknown;
  resultDetails: unknown;
  createdAt: Date;
  profile?: {
    id: string;
    nickname: string;
    realName: string | null;
    contactPhone: string | null;
    gender: string;
    ageMonths: number | null;
  } | null;
};

type DoctorReportSourceRecord = {
  id: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
};
type ReportResultDetails = {
  description?: string;
  scoreLabel?: string;
  scoreDisplay?: string;
  totalScoreLabel?: string;
  dimensions?: Record<string, unknown>;
  [key: string]: unknown;
};

function reportDb(tx: unknown = prisma) {
  return tx as {
    assessmentHistory: {
      findUnique(args: unknown): Promise<AssessmentReportSourceRecord | null>;
      findFirst(args: unknown): Promise<AssessmentReportSourceRecord | null>;
    };
    doctorProfile: {
      findUnique(args: unknown): Promise<DoctorReportSourceRecord | null>;
    };
    assessmentReport: AssessmentReportDelegate;
    reportTemplate: ReportTemplateDelegate;
  };
}

function normalizeAssessmentAnswers(answers: unknown) {
  if (!Array.isArray(answers)) {
    return [];
  }

  return answers.map((value) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  });
}

function normalizeResultDetails(value: unknown): ReportResultDetails {
  return (typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}) as ReportResultDetails;
}

function buildAssessmentAnswerRows(input: {
  scale: NonNullable<ReturnType<typeof getScaleDefinitionById>>;
  answers: Array<number | null>;
}): AssessmentReportAnswerRow[] {
  return input.scale.questions.map((question, index) => {
    const answerScore = input.answers[index];
    const selectedOption =
      answerScore === null ? undefined : question.options.find((option) => option.score === answerScore);

    return {
      questionId: question.id,
      questionText: resolveQuestionText(question, 'zh'),
      answerScore,
      answerLabel: selectedOption?.label || (answerScore === null ? '未作答' : String(answerScore)),
    };
  });
}

async function ensureReportTemplateForScale(scaleId: string, tx: unknown = prisma) {
  const templateConfig = resolveAssessmentReportTemplateConfig(scaleId);
  const model = getReportTemplateModel(tx);
  const existing = await model.findFirst({
    where: {
      name: templateConfig.name,
      templateVersion: templateConfig.templateVersion,
      status: 'ACTIVE',
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  if (existing) {
    return {
      record: existing,
      config: {
        ...templateConfig,
        hospitalName: existing.hospitalName || templateConfig.hospitalName,
        departmentName: existing.departmentName || templateConfig.departmentName,
        templateVersion: existing.templateVersion || templateConfig.templateVersion,
      },
    };
  }

  const created = await model.create({
    data: {
      name: templateConfig.name,
      templateVersion: templateConfig.templateVersion,
      hospitalName: templateConfig.hospitalName,
      departmentName: templateConfig.departmentName,
      scaleIds: templateConfig.scaleIds,
      status: 'ACTIVE',
      isDefault: true,
    },
  });

  return { record: created, config: templateConfig };
}

async function buildApprovedReportSnapshotForReview(input: {
  review: DoctorReviewRecord;
  approvedAt: Date;
  tx?: unknown;
}) {
  const db = reportDb(input.tx);
  const assessmentId = input.review.assessmentHistoryId || input.review.assessmentHistory?.id;
  if (!assessmentId) {
    throw new Error('Doctor review is not linked to an assessment history');
  }

  const assessment = await db.assessmentHistory.findUnique({
    where: { id: assessmentId },
    include: {
      profile: true,
    },
  });
  if (!assessment) {
    throw new Error('Assessment not found for report generation');
  }

  const member = assessment.profile || input.review.memberProfile || null;
  if (!member) {
    throw new Error('Assessment report requires a patient member snapshot');
  }

  const doctor =
    input.review.doctorProfile ||
    (await db.doctorProfile.findUnique({
      where: { id: input.review.doctorProfileId },
    }));
  if (!doctor) {
    throw new Error('Doctor profile not found for report generation');
  }

  const scale = getScaleDefinitionById(assessment.scaleId);
  if (!scale) {
    throw new Error(`Scale ${assessment.scaleId} not found`);
  }

  const answers = normalizeAssessmentAnswers(assessment.answers);
  const reportNo = buildAssessmentReportNo({
    scaleId: assessment.scaleId,
    approvedAt: input.approvedAt,
    doctorReviewId: input.review.id,
    assessmentHistoryId: assessment.id,
  });
  const { record: templateRecord, config: templateConfig } = await ensureReportTemplateForScale(
    assessment.scaleId,
    input.tx
  );

  const snapshot = buildAssessmentReportSnapshot({
    reportNo,
    template: templateConfig,
    assessment: {
      id: assessment.id,
      scaleId: assessment.scaleId,
      scaleName: resolveLocalizedText(scale.title, 'zh'),
      scaleVersion: assessment.scaleVersion || scale.version || '1.0',
      totalScore: assessment.totalScore,
      conclusion: assessment.conclusion,
      resultDetails: normalizeResultDetails(assessment.resultDetails),
      createdAt: assessment.createdAt,
    },
    member,
    doctor,
    review: {
      id: input.review.id,
      reviewConclusion: input.review.reviewConclusion,
      reviewNotes: input.review.reviewNotes,
      completedAt: input.review.completedAt || input.approvedAt,
    },
    approvedAt: input.approvedAt,
    answerRows: buildAssessmentAnswerRows({ scale, answers }),
  });

  return {
    assessment,
    templateRecord,
    snapshot,
    reportNo,
  };
}

async function ensureApprovedAssessmentReportForReview(input: {
  review: DoctorReviewRecord;
  parentVisible: boolean;
  approvedAt: Date;
  tx?: unknown;
}) {
  const { assessment, templateRecord, snapshot, reportNo } = await buildApprovedReportSnapshotForReview({
    review: input.review,
    approvedAt: input.approvedAt,
    tx: input.tx,
  });
  const model = getAssessmentReportModel(input.tx);
  const existing = await model.findFirst({
    where: {
      doctorReviewId: input.review.id,
      assessmentHistoryId: assessment.id,
    },
  });

  if (existing) {
    return await model.update({
      where: { id: existing.id },
      data: {
        reportNo: existing.reportNo || reportNo,
        templateId: templateRecord.id,
        scaleId: assessment.scaleId,
        assessmentHistoryId: assessment.id,
        assessmentSessionId: input.review.assessmentSessionId || null,
        memberProfileId: assessment.profileId || input.review.memberProfileId || null,
        reportStatus: 'APPROVED',
        reportSnapshot: snapshot,
        parentVisible: input.parentVisible,
        approvedByDoctorProfileId: input.review.doctorProfileId,
        approvedAt: input.approvedAt,
      },
    });
  }

  return await model.create({
    data: {
      reportNo,
      assessmentHistoryId: assessment.id,
      assessmentSessionId: input.review.assessmentSessionId || null,
      memberProfileId: assessment.profileId || input.review.memberProfileId || null,
      doctorReviewId: input.review.id,
      templateId: templateRecord.id,
      scaleId: assessment.scaleId,
      reportStatus: 'APPROVED',
      reportSnapshot: snapshot,
      parentVisible: input.parentVisible,
      approvedByDoctorProfileId: input.review.doctorProfileId,
      approvedAt: input.approvedAt,
    },
  });
}

async function ensureReportHiddenForReview(reviewId: string, tx: unknown = prisma) {
  await getAssessmentReportModel(tx).updateMany({
    where: {
      doctorReviewId: reviewId,
      reportStatus: 'APPROVED',
    },
    data: {
      reportStatus: 'REJECTED',
      parentVisible: false,
    },
  });
}

function isAssessmentReportSnapshot(value: unknown): value is AssessmentReportSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'template' in value &&
    'scale' in value &&
    'result' in value &&
    'review' in value
  );
}

export function resolveDoctorReviewDecision(input: {
  status: DoctorReviewDecisionStatus;
  reviewConclusion?: string | null;
  reviewNotes?: string | null;
  allowParentVisible?: boolean;
}) {
  const reviewNotes = normalizeNullableText(input.reviewNotes);
  const reviewConclusion = normalizeNullableText(input.reviewConclusion);

  if ((input.status === 'REJECTED' || input.status === 'NEEDS_MORE_INFO') && !reviewNotes) {
    throw new Error('拒绝或要求补充信息时必须填写复核备注');
  }

  return {
    status: input.status,
    reviewConclusion,
    reviewNotes,
    allowParentVisible: input.status === 'APPROVED' && input.allowParentVisible === true,
    completedAt: new Date(),
  };
}

export async function createPatientAccount(input: {
  phone: string;
  email?: string;
  passwordHash: string;
  deviceId?: string;
}) {
  const normalizedPhone = normalizeOptionalPhone(input.phone);
  if (!normalizedPhone) {
    throw new Error('Phone is required');
  }
  const existingDeviceUser = input.deviceId
    ? await resolveUserByDeviceId(input.deviceId)
    : null;

  const existingPhoneUser = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
  });

  if (existingPhoneUser && existingPhoneUser.id !== existingDeviceUser?.id) {
    throw new Error('该手机号已注册，请直接登录');
  }

  if (input.email) {
    const existingEmailUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingEmailUser && existingEmailUser.id !== existingDeviceUser?.id) {
      throw new Error('该邮箱已被使用');
    }
  }

  if (existingDeviceUser) {
    const emailChanged =
      input.email &&
      existingDeviceUser?.email &&
      existingDeviceUser.email !== input.email;
    const phoneChanged =
      existingDeviceUser?.phone &&
      existingDeviceUser.phone !== normalizedPhone;

    if (existingDeviceUser && !existingDeviceUser.isGuest && (emailChanged || phoneChanged)) {
      throw new Error('This device is already bound to another registered account');
    }

    if (existingDeviceUser) {
      return await prisma.user.update({
        where: { id: existingDeviceUser.id },
        data: {
          email: input.email || existingDeviceUser.email,
          phone: normalizedPhone,
          passwordHash: input.passwordHash,
          isGuest: false,
          role: 'REGISTERED',
          accountType: 'PATIENT',
          dailyLimit: 10,
          deviceId: null,
        },
      });
    }
  }

  return await prisma.user.create({
    data: {
      email: input.email,
      phone: normalizedPhone,
      passwordHash: input.passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'PATIENT',
      dailyLimit: 10,
      deviceId: null,
    },
  });
}

export async function createDoctorAccount(input: {
  email: string;
  phone?: string;
  passwordHash: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  licenseNo: string;
}) {
  return await prisma.user.create({
    data: {
      email: input.email,
      phone: normalizeOptionalPhone(input.phone),
      passwordHash: input.passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'DOCTOR',
      dailyLimit: 10,
      doctorProfile: {
        create: {
          realName: input.realName,
          hospitalName: input.hospitalName,
          departmentName: input.departmentName,
          title: input.title,
          licenseNo: input.licenseNo,
          verificationStatus: 'PENDING',
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });
}

export async function findDoctorUserForLogin(email: string) {
  return await prisma.user.findFirst({
    where: {
      email,
      doctorProfile: {
        isNot: null,
      },
    },
    include: {
      doctorProfile: true,
    },
  });
}

export async function findPatientUserForLogin(identifier: string) {
  const normalizedIdentifier = identifier.trim();
  const where = looksLikeEmail(normalizedIdentifier)
    ? { email: normalizedIdentifier }
    : { phone: normalizeOptionalPhone(normalizedIdentifier) };

  if (!where.email && !where.phone) {
    return null;
  }

  return await prisma.user.findFirst({
    where: {
      ...where,
      accountType: 'PATIENT',
    },
    include: {
      doctorProfile: true,
    },
  });
}

export async function getApprovedDoctors(search = '') {
  return await prisma.doctorProfile.findMany({
    where: {
      verificationStatus: 'APPROVED',
      OR: search
        ? [
            { realName: { contains: search, mode: 'insensitive' } },
            { hospitalName: { contains: search, mode: 'insensitive' } },
            { departmentName: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: [{ hospitalName: 'asc' }, { departmentName: 'asc' }, { realName: 'asc' }],
  });
}

export async function getMemberOwnedByPatient(userId: string, memberId: string) {
  const member = await prisma.memberProfile.findFirst({
    where: {
      id: memberId,
      userId,
    },
  });

  if (!member) {
    throw new Error('Member not found or not owned by current patient');
  }

  return member;
}

export async function assignDoctorToMember(input: {
  patientUserId: string;
  memberId: string;
  doctorProfileId: string;
}) {
  await getMemberOwnedByPatient(input.patientUserId, input.memberId);

  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      id: input.doctorProfileId,
      verificationStatus: 'APPROVED',
    },
  });

  if (!doctor) {
    throw new Error('Doctor not found or not approved');
  }

  return await prisma.$transaction(async (tx) => {
    await tx.careAssignment.updateMany({
      where: {
        memberProfileId: input.memberId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        endedAt: new Date(),
      },
    });

    await tx.memberCareAccessGrant.updateMany({
      where: {
        memberProfileId: input.memberId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return await tx.careAssignment.create({
      data: {
        memberProfileId: input.memberId,
        doctorProfileId: input.doctorProfileId,
        assignedByPatientUserId: input.patientUserId,
        status: 'ACTIVE',
      },
      include: {
        doctorProfile: true,
      },
    });
  });
}

export async function revokeDoctorAssignment(patientUserId: string, memberId: string) {
  await getMemberOwnedByPatient(patientUserId, memberId);

  await prisma.careAssignment.updateMany({
    where: {
      memberProfileId: memberId,
      status: 'ACTIVE',
    },
    data: {
      status: 'REVOKED',
      endedAt: new Date(),
    },
  });

  await prisma.memberCareAccessGrant.updateMany({
    where: {
      memberProfileId: memberId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getActiveDoctorAssignment(memberId: string) {
  return await prisma.careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      status: 'ACTIVE',
    },
    include: {
      memberProfile: true,
      doctorProfile: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function upsertResearchConsent(input: {
  memberId: string;
  grantedByUserId: string;
  status: 'GRANTED' | 'REVOKED';
}) {
  await getMemberOwnedByPatient(input.grantedByUserId, input.memberId);

  return await prisma.researchConsent.upsert({
    where: { memberProfileId: input.memberId },
    update: {
      status: input.status,
      grantedByUserId: input.grantedByUserId,
      ...(input.status === 'GRANTED'
        ? { grantedAt: new Date(), revokedAt: null }
        : { revokedAt: new Date() }),
    },
    create: {
      memberProfileId: input.memberId,
      grantedByUserId: input.grantedByUserId,
      status: input.status,
      ...(input.status === 'GRANTED'
        ? { grantedAt: new Date() }
        : { grantedAt: new Date(), revokedAt: new Date() }),
    },
  });
}

export async function getDoctorProfileForUser(userId: string) {
  return await prisma.doctorProfile.findUnique({
    where: { userId },
  });
}

export async function getDoctorDashboard(doctorProfileId: string) {
  const activeAssignments = await prisma.careAssignment.findMany({
    where: {
      doctorProfileId,
      status: 'ACTIVE',
    },
    include: {
      memberProfile: true,
    },
  });

  const patientIds = activeAssignments.map((item) => item.memberProfileId);

  const recentAssessments = patientIds.length
    ? await prisma.assessmentHistory.findMany({
        where: {
          profileId: { in: patientIds },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : [];

  const recentNotes = await prisma.doctorPatientNote.findMany({
    where: { doctorProfileId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const exportCount = await prisma.researchExportLog.count({
    where: { doctorProfileId },
  });
  const pendingReviewCount = await getDoctorReviewModel().count({
    where: {
      doctorProfileId,
      status: {
        in: ['PENDING', 'IN_REVIEW', 'NEEDS_MORE_INFO'],
      },
    },
  });

  return {
    patientCount: activeAssignments.length,
    recentAssessmentCount: recentAssessments.length,
    recentNotesCount: recentNotes.length,
    researchExportCount: exportCount,
    pendingReviewCount,
    recentAssessments,
    recentNotes,
  };
}

export async function listDoctorPatients(input: {
  doctorProfileId: string;
  search?: string;
  consent?: 'GRANTED' | 'REVOKED' | 'ALL';
}) {
  const accessRoles = await listAccessibleMemberRoles(input.doctorProfileId);
  const memberIds = accessRoles.map((item) => item.memberId);

  if (!memberIds.length) {
    return [];
  }

  const normalizedSearchPhone = normalizeOptionalPhone(input.search);
  const members = await prisma.memberProfile.findMany({
    where: {
      id: { in: memberIds },
      OR: input.search
        ? [
            { nickname: { contains: input.search, mode: 'insensitive' } },
            { realName: { contains: input.search, mode: 'insensitive' } },
            { contactPhone: { contains: normalizedSearchPhone || input.search } },
          ]
        : undefined,
    },
    include: {
      researchConsent: true,
      assessments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      user: true,
      careAssignments: {
        where: { status: 'ACTIVE' },
        include: {
          doctorProfile: true,
        },
        take: 1,
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const filtered = members.filter((member) => {
    if (!input.consent || input.consent === 'ALL') {
      return true;
    }
    return member.researchConsent?.status === input.consent;
  });

  const roleMap = new Map(accessRoles.map((item) => [item.memberId, item]));

  return filtered.map((member) => {
    const access = roleMap.get(member.id);
    const ownerAssignment = member.careAssignments[0] || null;
    const accessRole = access?.effectiveAccessRole || 'READONLY';

    return {
      assignmentId: ownerAssignment?.id || null,
      memberId: member.id,
      nickname: member.nickname,
      realName: member.realName,
      contactPhone: member.contactPhone,
      pendingClaim: member.pendingClaim,
      relation: member.relation,
      gender: member.gender,
      ageMonths: member.ageMonths,
      patientEmail: member.user.email,
      researchConsent: member.researchConsent?.status || 'NOT_GRANTED',
      latestAssessment: member.assessments[0]
        ? {
            scaleId: member.assessments[0].scaleId,
            conclusion: member.assessments[0].conclusion,
            totalScore: member.assessments[0].totalScore,
            createdAt: member.assessments[0].createdAt,
          }
        : null,
      startedAt: ownerAssignment?.startedAt || null,
      accessRole,
      accessSource: access?.source === 'OWNER' ? '主责' : accessRole === 'COLLABORATOR' ? '协作' : '只读',
      ownerDoctor: ownerAssignment
        ? {
            id: ownerAssignment.doctorProfile.id,
            realName: ownerAssignment.doctorProfile.realName,
            hospitalName: ownerAssignment.doctorProfile.hospitalName,
            departmentName: ownerAssignment.doctorProfile.departmentName,
            title: ownerAssignment.doctorProfile.title,
          }
        : null,
    };
  });
}

export async function createDoctorPatientAssessmentSession(input: {
  doctorProfileId: string;
  memberId: string;
  scaleId: string;
  mode?: DoctorPatientAssessmentMode;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);

  const member = await prisma.memberProfile.findUnique({
    where: { id: input.memberId },
    select: {
      id: true,
      userId: true,
    },
  });
  if (!member) {
    throw new Error('Patient member not found');
  }

  const scale = getDoctorVisibleScaleById(input.scaleId);
  if (!scale) {
    throw new Error('Scale is not available for doctor assessment');
  }

  const mode = input.mode || 'doctor_assisted';
  const shouldCreateHandoff = mode === 'caregiver_handoff' || canGenerateHandoffLink(scale);
  const handoffExpiresAt = shouldCreateHandoff
    ? new Date(Date.now() + DOCTOR_PATIENT_HANDOFF_TTL_MS)
    : null;
  const publicToken = handoffExpiresAt ? buildPublicAssessmentToken() : null;

  const session = await prisma.assessmentSession.create({
    data: {
      userId: member.userId,
      profileId: member.id,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      channel: mode === 'caregiver_handoff' ? 'doctor_patient_handoff' : 'doctor_patient_in_clinic',
      language: 'ZH',
      status: mode === 'caregiver_handoff' ? 'HANDOFF_READY' : 'ONGOING',
      publicToken,
      publicTokenExpiresAt: handoffExpiresAt,
      answers: serializeJson(Array.from({ length: scale.questions.length }, () => null)),
      currentQuestionIndex: 0,
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: member.id,
    action: 'DOCTOR_PATIENT_ASSESSMENT_SESSION_CREATED',
    metadata: {
      sessionId: session.id,
      scaleId: scale.id,
      mode,
      handoffCreated: Boolean(publicToken),
    },
  });

  return {
    sessionId: session.id,
    scaleId: scale.id,
    scaleTitle: resolveLocalizedText(scale.title, 'zh'),
    interactionMode: scale.interactionMode || 'manual_only',
    resultDeliveryMode: scale.resultDeliveryMode || 'immediate',
    status: session.status,
    handoff: publicToken
      ? {
          path: `/assessment/handoff/${publicToken}`,
          expiresAt: handoffExpiresAt!.toISOString(),
        }
      : null,
  };
}

export async function getDoctorPatientDetail(doctorProfileId: string, memberId: string) {
  const access = await assertDoctorCanAccessMember(memberId, doctorProfileId);
  const assignment = await prisma.careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      status: 'ACTIVE',
    },
    include: {
      memberProfile: {
        include: {
          user: true,
          researchConsent: true,
        },
      },
      doctorProfile: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!assignment) {
    throw new Error('Patient member not found');
  }

  return {
    ...assignment,
    effectiveAccessRole: access.effectiveAccessRole,
    accessSource: access.source,
    ownerDoctorProfile: assignment.doctorProfile,
  };
}

export async function getDoctorPatientTimeline(doctorProfileId: string, memberId: string) {
  await assertDoctorCanAccessMember(memberId, doctorProfileId);

  const [assessments, notes] = await Promise.all([
    dbWithPhase1Models().assessmentHistory.findMany({
      where: { profileId: memberId },
      include: {
        doctorReviews: {
          where: {
            doctorProfileId,
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.doctorPatientNote.findMany({
      where: {
        memberProfileId: memberId,
      },
      include: {
        doctorProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const events = [
    ...assessments.map((item) => ({
      type: 'ASSESSMENT' as const,
      id: item.id,
      createdAt: item.createdAt,
      scaleId: item.scaleId,
      totalScore: item.totalScore,
      conclusion: item.conclusion,
      source: item.source,
      respondentRealName: item.respondentRealName,
      respondentPhone: item.respondentPhone,
      respondentGender: item.respondentGender,
      respondentAgeMonths: item.respondentAgeMonths,
      review: item.doctorReviews[0]
        ? {
            id: item.doctorReviews[0].id,
            status: item.doctorReviews[0].status,
            reviewConclusion: item.doctorReviews[0].reviewConclusion,
            reviewNotes: item.doctorReviews[0].reviewNotes,
            allowParentVisible: item.doctorReviews[0].allowParentVisible,
            completedAt: item.doctorReviews[0].completedAt,
          }
        : null,
    })),
    ...notes.map((item) => ({
      type: 'DOCTOR_NOTE' as const,
      id: item.id,
      createdAt: item.createdAt,
      noteType: item.noteType,
      content: item.content,
      doctorName: item.doctorProfile.realName,
      assessmentHistoryId: item.assessmentHistoryId,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return events;
}

export async function createDoctorPatientNote(input: {
  doctorProfileId: string;
  memberId: string;
  assessmentHistoryId?: string;
  noteType: 'CLINICAL' | 'RESEARCH';
  content: string;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);

  if (input.assessmentHistoryId) {
    const assessment = await prisma.assessmentHistory.findFirst({
      where: {
        id: input.assessmentHistoryId,
        profileId: input.memberId,
      },
    });

    if (!assessment) {
      throw new Error('Assessment not found for this member');
    }
  }

  const note = await prisma.doctorPatientNote.create({
    data: {
      doctorProfileId: input.doctorProfileId,
      memberProfileId: input.memberId,
      assessmentHistoryId: input.assessmentHistoryId,
      noteType: input.noteType,
      content: input.content,
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: input.memberId,
    action: 'PATIENT_NOTE_CREATED',
    metadata: {
      noteType: input.noteType,
    },
  });

  return note;
}

function mapDoctorReviewItem(review: DoctorReviewRecord) {
  const assessment = review.assessmentHistory || null;
  const session = review.assessmentSession || null;
  const member = review.memberProfile || null;
  const scaleId = assessment?.scaleId || session?.scaleId || null;
  const scale = scaleId ? getScaleDefinitionById(scaleId) : null;

  return {
    id: review.id,
    status: review.status,
    reviewConclusion: review.reviewConclusion,
    reviewNotes: review.reviewNotes,
    allowParentVisible: review.allowParentVisible,
    startedAt: review.startedAt,
    completedAt: review.completedAt,
    durationSeconds: review.durationSeconds,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    member: member
      ? {
          id: member.id,
          nickname: member.nickname,
          realName: member.realName,
          contactPhone: member.contactPhone,
          gender: member.gender,
          ageMonths: member.ageMonths,
        }
      : null,
    assessment: assessment
      ? {
          id: assessment.id,
          scaleId: assessment.scaleId,
          scaleTitle: scale ? resolveLocalizedText(scale.title, 'zh') : assessment.scaleId,
          totalScore: assessment.totalScore,
          conclusion: assessment.conclusion,
          createdAt: assessment.createdAt,
        }
      : null,
    session: session
      ? {
          id: session.id,
          scaleId: session.scaleId,
          status: session.status,
          completedAt: session.completedAt,
        }
      : null,
  };
}

async function resolveDoctorProfileForPendingReview(input: {
  memberProfileId: string;
  doctorProfileId?: string | null;
}) {
  if (input.doctorProfileId) {
    await assertDoctorCanWriteMember(input.memberProfileId, input.doctorProfileId);
    return input.doctorProfileId;
  }

  const assignment = await getActiveDoctorAssignment(input.memberProfileId);
  return assignment?.doctorProfileId || null;
}

export async function ensurePendingDoctorReviewForAssessment(input: {
  assessmentHistoryId: string;
  assessmentSessionId?: string | null;
  memberProfileId?: string | null;
  doctorProfileId?: string | null;
}) {
  const assessment = await dbWithPhase1Models().assessmentHistory.findUnique({
    where: { id: input.assessmentHistoryId },
    select: {
      id: true,
      profileId: true,
      scaleId: true,
    },
  });

  if (!assessment || !isPhysicianReviewScale(assessment.scaleId)) {
    return null;
  }

  const memberProfileId = input.memberProfileId || assessment.profileId;
  if (!memberProfileId) {
    return null;
  }

  const doctorProfileId = await resolveDoctorProfileForPendingReview({
    memberProfileId,
    doctorProfileId: input.doctorProfileId,
  });
  if (!doctorProfileId) {
    return null;
  }

  const existing = await getDoctorReviewModel().findFirst({
    where: {
      assessmentHistoryId: assessment.id,
      doctorProfileId,
    },
  });

  if (existing) {
    return existing;
  }

  const review = await getDoctorReviewModel().create({
    data: {
      assessmentHistoryId: assessment.id,
      assessmentSessionId: input.assessmentSessionId || null,
      memberProfileId,
      doctorProfileId,
      status: 'PENDING',
      allowParentVisible: false,
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: doctorProfileId,
    memberId: memberProfileId,
    action: 'DOCTOR_REVIEW_PENDING_CREATED',
    metadata: {
      assessmentHistoryId: assessment.id,
      assessmentSessionId: input.assessmentSessionId || null,
      scaleId: assessment.scaleId,
    },
  });

  return review;
}

export async function listDoctorReviews(input: {
  doctorProfileId: string;
  status?: DoctorReviewQueueStatus;
}) {
  const status = input.status || 'PENDING';
  const reviews = await getDoctorReviewModel().findMany({
    where: {
      doctorProfileId: input.doctorProfileId,
      ...(status === 'ALL'
        ? {}
        : status === 'PENDING'
          ? {
              status: {
                in: ['PENDING', 'IN_REVIEW', 'NEEDS_MORE_INFO'],
              },
            }
          : { status }),
    },
    include: {
      assessmentHistory: true,
      assessmentSession: true,
      memberProfile: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return reviews.map(mapDoctorReviewItem);
}

export async function completeDoctorReview(input: {
  doctorProfileId: string;
  reviewId: string;
  status: DoctorReviewDecisionStatus;
  reviewConclusion?: string | null;
  reviewNotes?: string | null;
  allowParentVisible?: boolean;
}) {
  const review = await getDoctorReviewModel().findUnique({
    where: { id: input.reviewId },
    include: {
      assessmentHistory: true,
      assessmentSession: true,
      memberProfile: true,
      doctorProfile: true,
    },
  });

  if (!review) {
    throw new Error('Doctor review not found');
  }

  if (review.doctorProfileId !== input.doctorProfileId) {
    throw new Error('当前医生不能复核该记录');
  }

  const memberProfileId = review.memberProfileId || review.assessmentHistory?.profileId;
  if (!memberProfileId) {
    throw new Error('Doctor review is not linked to a patient member');
  }

  await assertDoctorCanWriteMember(memberProfileId, input.doctorProfileId);

  const decision = resolveDoctorReviewDecision(input);
  const startedAt = review.startedAt || decision.completedAt;
  const durationSeconds = Math.max(
    0,
    Math.floor((decision.completedAt.getTime() - new Date(startedAt).getTime()) / 1000)
  );

  const updated = await prisma.$transaction(async (tx) => {
    const nextReview = await getDoctorReviewModel(tx).update({
      where: { id: review.id },
      data: {
        status: decision.status,
        reviewConclusion: decision.reviewConclusion,
        reviewNotes: decision.reviewNotes,
        allowParentVisible: decision.allowParentVisible,
        startedAt,
        completedAt: decision.completedAt,
        durationSeconds,
      },
      include: {
        assessmentHistory: true,
        assessmentSession: true,
        memberProfile: true,
        doctorProfile: true,
      },
    });

    if (decision.status === 'APPROVED') {
      await ensureApprovedAssessmentReportForReview({
        review: nextReview,
        parentVisible: decision.allowParentVisible,
        approvedAt: decision.completedAt,
        tx,
      });
    } else {
      await ensureReportHiddenForReview(review.id, tx);
    }

    return nextReview;
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: memberProfileId,
    action: 'DOCTOR_REVIEW_COMPLETED',
    metadata: {
      doctorReviewId: review.id,
      assessmentHistoryId: review.assessmentHistoryId,
      status: decision.status,
      allowParentVisible: decision.allowParentVisible,
    },
  });

  return mapDoctorReviewItem(updated);
}

export async function assertPatientCanViewReviewedAssessmentReport(input: {
  userId: string;
  assessmentId: string;
  scaleId?: string;
}) {
  const assessment = await dbWithPhase1Models().assessmentHistory.findFirst({
    where: {
      id: input.assessmentId,
      userId: input.userId,
    },
    select: {
      id: true,
      scaleId: true,
    },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  if (!isPhysicianReviewScale(input.scaleId || assessment.scaleId)) {
    return true;
  }

  const assessmentReport = await getAssessmentReportModel().findFirst({
    where: {
      assessmentHistoryId: assessment.id,
      reportStatus: 'APPROVED',
      parentVisible: true,
    },
    select: { id: true },
  });

  if (!assessmentReport) {
    throw new PatientReportVisibilityError();
  }

  return true;
}

export async function getPatientVisibleAssessmentReport(input: {
  userId: string;
  assessmentId: string;
}) {
  const assessment = await reportDb().assessmentHistory.findFirst({
    where: {
      id: input.assessmentId,
      userId: input.userId,
    },
  });

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  const report = await getAssessmentReportModel().findFirst({
    where: {
      assessmentHistoryId: assessment.id,
      reportStatus: 'APPROVED',
      parentVisible: true,
    },
    orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (!report || !isAssessmentReportSnapshot(report.reportSnapshot)) {
    throw new PatientReportVisibilityError();
  }

  return {
    assessment,
    report,
    snapshot: report.reportSnapshot,
  };
}

export async function exportDoctorPatientResearchData(input: {
  doctorProfileId: string;
  requestedByUserId: string;
  memberId: string;
  format: 'CSV' | 'JSON';
  purpose: string;
}) {
  await assertDoctorOwnsMember(input.memberId, input.doctorProfileId);
  const assignment = await getDoctorPatientDetail(input.doctorProfileId, input.memberId);
  const consent = assignment.memberProfile.researchConsent;

  if (!consent || consent.status !== 'GRANTED') {
    throw new Error('Research consent is required before export');
  }

  const assessments = await prisma.assessmentHistory.findMany({
    where: { profileId: input.memberId },
    orderBy: { createdAt: 'asc' },
  });
  const notes = await prisma.doctorPatientNote.findMany({
    where: {
      memberProfileId: input.memberId,
      doctorProfileId: input.doctorProfileId,
      noteType: 'RESEARCH',
    },
    orderBy: { createdAt: 'asc' },
  });

  const researchSubjectId = createResearchSubjectId(assignment.memberProfile.id);
  if (!researchSubjectId) {
    throw new Error('Research subject id cannot be generated for this member');
  }
  const rows = assessments.map((item) => ({
    research_subject_id: researchSubjectId,
    relation: String(assignment.memberProfile.relation).toLowerCase(),
    ageMonths: assignment.memberProfile.ageMonths,
    gender: assignment.memberProfile.gender,
    scaleId: item.scaleId,
    scaleVersion: item.scaleVersion,
    totalScore: item.totalScore,
    conclusion: item.conclusion,
    assessedAt: item.createdAt.toISOString(),
  }));

  const researchNotes = notes.map((item) => ({
    research_subject_id: researchSubjectId,
    noteType: item.noteType,
    content: item.content,
    createdAt: item.createdAt.toISOString(),
  }));

  await prisma.researchExportLog.create({
    data: {
      memberProfileId: input.memberId,
      doctorProfileId: input.doctorProfileId,
      requestedByUserId: input.requestedByUserId,
      format: input.format,
      purpose: input.purpose,
      exportedFields: {
        assessmentFields: ['research_subject_id', 'relation', 'ageMonths', 'gender', 'scaleId', 'scaleVersion', 'totalScore', 'conclusion', 'assessedAt'],
        noteFields: ['research_subject_id', 'noteType', 'content', 'createdAt'],
      },
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: input.memberId,
    action: 'PATIENT_EXPORT_CREATED',
    metadata: {
      format: input.format,
      purpose: input.purpose,
    },
  });

  if (input.format === 'JSON') {
    return {
      filename: `${researchSubjectId}-research.json`,
      mimeType: 'application/json',
      content: JSON.stringify({ assessments: rows, notes: researchNotes }, null, 2),
    };
  }

  const csvLines = [
    'research_subject_id,relation,ageMonths,gender,scaleId,scaleVersion,totalScore,conclusion,assessedAt',
    ...rows.map((row) =>
      [
        row.research_subject_id,
        row.relation,
        row.ageMonths ?? '',
        row.gender,
        row.scaleId,
        row.scaleVersion,
        row.totalScore,
        row.conclusion.replace(/,/g, ' '),
        row.assessedAt,
      ].join(',')
    ),
    '',
    'research_subject_id,noteType,content,createdAt',
    ...researchNotes.map((row) =>
      [
        row.research_subject_id,
        row.noteType,
        `"${row.content.replace(/"/g, '""')}"`,
        row.createdAt,
      ].join(',')
    ),
  ];

  return {
    filename: `${researchSubjectId}-research.csv`,
    mimeType: 'text/csv; charset=utf-8',
    content: csvLines.join('\n'),
  };
}

export async function getDoctorAssessmentReport(input: {
  doctorProfileId: string;
  memberId: string;
  assessmentId: string;
}) {
  const assignment = await getDoctorPatientDetail(input.doctorProfileId, input.memberId);

  const assessment = await prisma.assessmentHistory.findFirst({
    where: {
      id: input.assessmentId,
      profileId: input.memberId,
    },
  });

  if (!assessment) {
    throw new Error('Assessment not found for this member');
  }

  const scale = getScaleDefinitionById(assessment.scaleId);
  if (!scale) {
    throw new Error(`Scale ${assessment.scaleId} not found`);
  }

  const formalReport = await getAssessmentReportModel().findFirst({
    where: {
      assessmentHistoryId: assessment.id,
      memberProfileId: input.memberId,
      reportStatus: 'APPROVED',
    },
    orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
  });
  if (!formalReport || !isAssessmentReportSnapshot(formalReport.reportSnapshot)) {
    throw new Error('正式报告需医生复核通过后生成');
  }

  const answers = normalizeAssessmentAnswers(assessment.answers);
  const recomputed = evaluateScaleAnswers(scale.id, answers.map((value) => value ?? 0));
  const answerDetails = buildAssessmentAnswerRows({ scale, answers });

  return {
    assessmentId: assessment.id,
    reportNo: formalReport.reportNo,
    report: formalReport.reportSnapshot,
    member: {
      nickname: assignment.memberProfile.nickname,
      realName: assignment.memberProfile.realName,
      relation: String(assignment.memberProfile.relation || 'SELF'),
      gender: assignment.memberProfile.gender,
      ageMonths: assignment.memberProfile.ageMonths,
      contactPhone: assignment.memberProfile.contactPhone,
    },
    scale: {
      id: scale.id,
      name: resolveLocalizedText(scale.title, 'zh'),
      version: assessment.scaleVersion || scale.version || '1.0',
    },
    result: {
      totalScore: assessment.totalScore,
      conclusion: assessment.conclusion,
      details: recomputed.details,
    },
    answerDetails,
    assessedAt: assessment.createdAt.toISOString(),
    exportedAt: new Date().toISOString(),
  };
}

export async function listDoctors(status: DoctorStatusFilter = 'ALL') {
  return await prisma.doctorProfile.findMany({
    where: {
      verificationStatus: status === 'ALL' ? undefined : status,
    },
    include: {
      user: {
        select: {
          email: true,
          phone: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function listPendingDoctors() {
  return await listDoctors('PENDING');
}

export async function updateDoctorVerification(input: {
  doctorProfileId: string;
  status: DoctorStatus;
  adminId?: string;
  reviewNotes?: string;
}) {
  const data: {
    verificationStatus: DoctorStatus;
    reviewNotes?: string;
    approvedAt?: Date;
    approvedByAdminId?: string | null;
  } = {
    verificationStatus: input.status,
    reviewNotes: input.reviewNotes,
  };

  if (input.status === 'APPROVED') {
    data.approvedAt = new Date();
    data.approvedByAdminId = input.adminId || null;
  }

  if (input.status === 'REJECTED' || input.status === 'SUSPENDED') {
    data.approvedByAdminId = input.adminId || null;
  }

  return await prisma.doctorProfile.update({
    where: { id: input.doctorProfileId },
    data,
    include: {
      user: true,
    },
  });
}

export async function updateDoctorProfile(input: {
  doctorProfileId: string;
  realName?: string;
  hospitalName?: string;
  departmentName?: string;
  title?: string;
}) {
  await assertDoctorProfileBoundaryChangeAllowed({
    doctorProfileId: input.doctorProfileId,
    nextHospitalName: input.hospitalName,
    nextDepartmentName: input.departmentName,
  });

  return await prisma.doctorProfile.update({
    where: { id: input.doctorProfileId },
    data: {
      realName: input.realName,
      hospitalName: input.hospitalName,
      departmentName: input.departmentName,
      title: input.title,
    },
  });
}

export async function adminDeleteDoctor(doctorProfileId: string) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: {
      careTeamMemberships: { select: { teamId: true } },
    },
  });

  if (!profile) {
    throw new Error('未找到该医生');
  }

  if (profile.careTeamMemberships.length > 0) {
    throw new Error('该医生仍属于团队，请先将其从所有团队中移除');
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctorProfile.delete({ where: { id: doctorProfileId } });
    await tx.user.delete({ where: { id: profile.userId } });
  });

  return { success: true };
}
