import { prisma } from '@/lib/db/prisma';
import { resolveUserByDeviceId } from '@/lib/assessment-skill/member-service';

type DoctorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export async function createPatientAccount(input: {
  email: string;
  phone?: string;
  passwordHash: string;
  deviceId?: string;
}) {
  if (input.deviceId) {
    const existingDeviceUser = await resolveUserByDeviceId(input.deviceId);
    if (existingDeviceUser && !existingDeviceUser.isGuest && existingDeviceUser.email && existingDeviceUser.email !== input.email) {
      throw new Error('This device is already bound to another registered account');
    }

    if (existingDeviceUser) {
      return await prisma.user.update({
        where: { id: existingDeviceUser.id },
        data: {
          email: input.email,
          phone: input.phone || existingDeviceUser.phone,
          passwordHash: input.passwordHash,
          isGuest: false,
          role: 'REGISTERED',
          accountType: 'PATIENT',
          dailyLimit: 10,
        },
      });
    }
  }

  return await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'PATIENT',
      dailyLimit: 10,
      deviceId: input.deviceId || null,
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
      phone: input.phone,
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

export async function findUserForLogin(email: string) {
  return await prisma.user.findUnique({
    where: { email },
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
  const assignments = await prisma.careAssignment.findMany({
    where: {
      doctorProfileId: input.doctorProfileId,
      status: 'ACTIVE',
      memberProfile: {
        nickname: input.search ? { contains: input.search, mode: 'insensitive' } : undefined,
      },
    },
    include: {
      memberProfile: {
        include: {
          researchConsent: true,
          assessments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          user: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const filtered = assignments.filter((item) => {
    if (!input.consent || input.consent === 'ALL') {
      return true;
    }
    return item.memberProfile.researchConsent?.status === input.consent;
  });

  return filtered.map((item) => ({
    assignmentId: item.id,
    memberId: item.memberProfile.id,
    nickname: item.memberProfile.nickname,
    relation: item.memberProfile.relation,
    gender: item.memberProfile.gender,
    ageMonths: item.memberProfile.ageMonths,
    patientEmail: item.memberProfile.user.email,
    researchConsent: item.memberProfile.researchConsent?.status || 'NOT_GRANTED',
    latestAssessment: item.memberProfile.assessments[0]
      ? {
          scaleId: item.memberProfile.assessments[0].scaleId,
          conclusion: item.memberProfile.assessments[0].conclusion,
          totalScore: item.memberProfile.assessments[0].totalScore,
          createdAt: item.memberProfile.assessments[0].createdAt,
        }
      : null,
    startedAt: item.startedAt,
  }));
}

export async function getDoctorPatientDetail(doctorProfileId: string, memberId: string) {
  const assignment = await prisma.careAssignment.findFirst({
    where: {
      doctorProfileId,
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
    },
  });

  if (!assignment) {
    throw new Error('Patient member is not assigned to current doctor');
  }

  return assignment;
}

export async function getDoctorPatientTimeline(doctorProfileId: string, memberId: string) {
  await getDoctorPatientDetail(doctorProfileId, memberId);

  const [assessments, notes] = await Promise.all([
    prisma.assessmentHistory.findMany({
      where: { profileId: memberId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.doctorPatientNote.findMany({
      where: {
        doctorProfileId,
        memberProfileId: memberId,
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
    })),
    ...notes.map((item) => ({
      type: 'DOCTOR_NOTE' as const,
      id: item.id,
      createdAt: item.createdAt,
      noteType: item.noteType,
      content: item.content,
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
  await getDoctorPatientDetail(input.doctorProfileId, input.memberId);

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

  return await prisma.doctorPatientNote.create({
    data: {
      doctorProfileId: input.doctorProfileId,
      memberProfileId: input.memberId,
      assessmentHistoryId: input.assessmentHistoryId,
      noteType: input.noteType,
      content: input.content,
    },
  });
}

export async function exportDoctorPatientResearchData(input: {
  doctorProfileId: string;
  requestedByUserId: string;
  memberId: string;
  format: 'CSV' | 'JSON';
  purpose: string;
}) {
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

export async function listPendingDoctors() {
  return await prisma.doctorProfile.findMany({
    where: {
      verificationStatus: 'PENDING',
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
    orderBy: { createdAt: 'asc' },
  });
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
