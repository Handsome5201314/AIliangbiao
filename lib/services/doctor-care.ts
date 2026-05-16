import { prisma } from '@/lib/db/prisma';
import { resolveUserByDeviceId } from '@/lib/assessment-skill/member-service';
import { getScaleDefinitionById, evaluateScaleAnswers } from '@/lib/scales/catalog';
import { resolveLocalizedText, resolveQuestionText } from '@/lib/schemas/core/i18n';
import { looksLikeEmail, normalizeOptionalPhone } from '@/lib/utils/contact';
import {
  assertDoctorCanAccessMember,
  assertDoctorCanWriteMember,
  assertDoctorOwnsMember,
  assertDoctorProfileBoundaryChangeAllowed,
  listAccessibleMemberRoles,
  logPatientWriteAction,
} from '@/lib/services/care-teams';

type DoctorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
type DoctorStatusFilter = DoctorStatus | 'ALL';

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

  return {
    patientCount: activeAssignments.length,
    recentAssessmentCount: recentAssessments.length,
    recentNotesCount: recentNotes.length,
    researchExportCount: exportCount,
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
    prisma.assessmentHistory.findMany({
      where: { profileId: memberId },
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

  const memberStudyId = `MS-${assignment.memberProfile.id.slice(0, 8).toUpperCase()}`;
  const rows = assessments.map((item) => ({
    memberStudyId,
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
    memberStudyId,
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
        assessmentFields: ['memberStudyId', 'relation', 'ageMonths', 'gender', 'scaleId', 'scaleVersion', 'totalScore', 'conclusion', 'assessedAt'],
        noteFields: ['memberStudyId', 'noteType', 'content', 'createdAt'],
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
      filename: `${memberStudyId}-research.json`,
      mimeType: 'application/json',
      content: JSON.stringify({ assessments: rows, notes: researchNotes }, null, 2),
    };
  }

  const csvLines = [
    'memberStudyId,relation,ageMonths,gender,scaleId,scaleVersion,totalScore,conclusion,assessedAt',
    ...rows.map((row) =>
      [
        row.memberStudyId,
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
    'memberStudyId,noteType,content,createdAt',
    ...researchNotes.map((row) =>
      [
        row.memberStudyId,
        row.noteType,
        `"${row.content.replace(/"/g, '""')}"`,
        row.createdAt,
      ].join(',')
    ),
  ];

  return {
    filename: `${memberStudyId}-research.csv`,
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

  const answers = Array.isArray(assessment.answers)
    ? assessment.answers.map((value) => (typeof value === 'number' ? value : Number(value)))
    : [];

  const recomputed = evaluateScaleAnswers(scale.id, answers);
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
    assessmentId: assessment.id,
    member: {
      nickname: assignment.memberProfile.nickname,
      relation: String(assignment.memberProfile.relation || 'SELF'),
      gender: assignment.memberProfile.gender,
      ageMonths: assignment.memberProfile.ageMonths,
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
  const data: any = {
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
