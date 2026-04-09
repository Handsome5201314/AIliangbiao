import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { memberProfileModel } from '@/lib/domain/member-profile';

function getResearchExportSalt() {
  return process.env.RESEARCH_EXPORT_SALT || process.env.SESSION_SECRET || 'local-research-export-salt';
}

function buildStudyId(memberProfileId: string) {
  return crypto.createHash('sha256').update(`${memberProfileId}:${getResearchExportSalt()}`).digest('hex').slice(0, 16);
}

async function assertPatientMemberOwnership(patientUserId: string, memberId: string) {
  const member = await memberProfileModel().findFirst({
    where: { id: memberId, userId: patientUserId },
  });

  if (!member) {
    throw new Error('Member not found or not accessible');
  }

  return member;
}

async function assertDoctorMemberAccess(doctorProfileId: string, memberId: string) {
  const assignment = await prisma.careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      doctorProfileId,
      status: 'ACTIVE',
    },
  });

  if (!assignment) {
    throw new Error('Forbidden member access');
  }

  return assignment;
}

export async function searchApprovedDoctors(query?: string) {
  const keyword = query?.trim();

  return await prisma.doctorProfile.findMany({
    where: {
      verificationStatus: 'APPROVED',
      ...(keyword
        ? {
            OR: [
              { realName: { contains: keyword, mode: 'insensitive' } },
              { hospitalName: { contains: keyword, mode: 'insensitive' } },
              { departmentName: { contains: keyword, mode: 'insensitive' } },
              { title: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ hospitalName: 'asc' }, { realName: 'asc' }],
    select: {
      id: true,
      realName: true,
      hospitalName: true,
      departmentName: true,
      title: true,
      verificationStatus: true,
    },
  });
}

export async function getAttendingDoctorForMember(patientUserId: string, memberId: string) {
  await assertPatientMemberOwnership(patientUserId, memberId);

  return await prisma.careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      status: 'ACTIVE',
    },
    include: {
      doctorProfile: {
        select: {
          id: true,
          realName: true,
          hospitalName: true,
          departmentName: true,
          title: true,
          verificationStatus: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function assignAttendingDoctor(input: {
  patientUserId: string;
  memberId: string;
  doctorProfileId: string;
}) {
  await assertPatientMemberOwnership(input.patientUserId, input.memberId);

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: input.doctorProfileId },
  });
  if (!doctor || doctor.verificationStatus !== 'APPROVED') {
    throw new Error('Doctor is not available for assignment');
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

export async function revokeAttendingDoctor(patientUserId: string, memberId: string) {
  await assertPatientMemberOwnership(patientUserId, memberId);

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

export async function setResearchConsent(input: {
  patientUserId: string;
  memberId: string;
  granted: boolean;
}) {
  await assertPatientMemberOwnership(input.patientUserId, input.memberId);

  return await prisma.researchConsent.upsert({
    where: { memberProfileId: input.memberId },
    update: {
      grantedByUserId: input.patientUserId,
      status: input.granted ? 'GRANTED' : 'REVOKED',
      revokedAt: input.granted ? null : new Date(),
      ...(input.granted ? { grantedAt: new Date() } : {}),
    },
    create: {
      memberProfileId: input.memberId,
      grantedByUserId: input.patientUserId,
      status: input.granted ? 'GRANTED' : 'REVOKED',
      revokedAt: input.granted ? null : new Date(),
    },
  });
}

export async function getDoctorDashboard(doctorProfileId: string) {
  const activeAssignments = await prisma.careAssignment.findMany({
    where: {
      doctorProfileId,
      status: 'ACTIVE',
    },
    select: {
      memberProfileId: true,
    },
  });

  const memberIds = activeAssignments.map((item) => item.memberProfileId);
  const recentAssessments = memberIds.length
    ? await prisma.assessmentHistory.count({
        where: {
          profileId: { in: memberIds },
          createdAt: {
            gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
          },
        },
      })
    : 0;
  const recentNotes = await prisma.doctorPatientNote.count({
    where: {
      doctorProfileId,
      createdAt: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      },
    },
  });

  return {
    patientCount: memberIds.length,
    recentAssessments,
    recentNotes,
  };
}

export async function listDoctorPatients(doctorProfileId: string, search?: string) {
  const keyword = search?.trim();

  const assignments = await prisma.careAssignment.findMany({
    where: {
      doctorProfileId,
      status: 'ACTIVE',
      ...(keyword
        ? {
            memberProfile: {
              OR: [
                { nickname: { contains: keyword, mode: 'insensitive' } },
                { relation: { equals: keyword.toUpperCase() as any } },
                { user: { email: { contains: keyword, mode: 'insensitive' } } },
              ],
            },
          }
        : {}),
    },
    include: {
      memberProfile: {
        include: {
          user: {
            select: { email: true },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  const memberIds = assignments.map((assignment) => assignment.memberProfileId);
  const latestAssessments = memberIds.length
    ? await prisma.assessmentHistory.findMany({
        where: {
          profileId: { in: memberIds },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          profileId: true,
          scaleId: true,
          conclusion: true,
          createdAt: true,
        },
      })
    : [];
  const consentMap = new Map(
    (await prisma.researchConsent.findMany({
      where: {
        memberProfileId: { in: memberIds },
      },
    })).map((consent) => [consent.memberProfileId, consent])
  );

  return assignments.map((assignment) => {
    const latestAssessment = latestAssessments.find((item) => item.profileId === assignment.memberProfileId);
    const consent = consentMap.get(assignment.memberProfileId);
    return {
      assignmentId: assignment.id,
      memberId: assignment.memberProfileId,
      nickname: assignment.memberProfile.nickname,
      relation: String(assignment.memberProfile.relation).toLowerCase(),
      gender: assignment.memberProfile.gender,
      ageMonths: assignment.memberProfile.ageMonths,
      patientEmail: assignment.memberProfile.user?.email || null,
      startedAt: assignment.startedAt,
      latestAssessment,
      researchConsentStatus: consent?.status || 'REVOKED',
    };
  });
}

export async function getDoctorPatientDetail(doctorProfileId: string, memberId: string) {
  await assertDoctorMemberAccess(doctorProfileId, memberId);

  const member = await memberProfileModel().findFirst({
    where: { id: memberId },
    include: {
      user: {
        select: {
          email: true,
          phone: true,
        },
      },
    },
  });

  const careAssignment = await prisma.careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      doctorProfileId,
      status: 'ACTIVE',
    },
    orderBy: { startedAt: 'desc' },
  });

  const researchConsent = await prisma.researchConsent.findUnique({
    where: { memberProfileId: memberId },
  });

  const assessments = await prisma.assessmentHistory.findMany({
    where: { profileId: memberId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      scaleId: true,
      scaleVersion: true,
      totalScore: true,
      conclusion: true,
      resultDetails: true,
      createdAt: true,
    },
  });

  return {
    member,
    careAssignment,
    researchConsent,
    assessments,
  };
}

export async function getDoctorPatientTimeline(doctorProfileId: string, memberId: string) {
  await assertDoctorMemberAccess(doctorProfileId, memberId);

  const [assessments, notes] = await Promise.all([
    prisma.assessmentHistory.findMany({
      where: { profileId: memberId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scaleId: true,
        scaleVersion: true,
        totalScore: true,
        conclusion: true,
        resultDetails: true,
        createdAt: true,
      },
    }),
    prisma.doctorPatientNote.findMany({
      where: {
        memberProfileId: memberId,
        doctorProfileId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        assessmentHistoryId: true,
        noteType: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const timeline = [
    ...assessments.map((assessment) => ({
      type: 'ASSESSMENT' as const,
      createdAt: assessment.createdAt,
      payload: assessment,
    })),
    ...notes.map((note) => ({
      type: 'DOCTOR_NOTE' as const,
      createdAt: note.createdAt,
      payload: note,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return timeline;
}

export async function addDoctorPatientNote(input: {
  doctorProfileId: string;
  memberId: string;
  content: string;
  noteType?: 'CLINICAL' | 'RESEARCH';
  assessmentHistoryId?: string;
}) {
  await assertDoctorMemberAccess(input.doctorProfileId, input.memberId);

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
      memberProfileId: input.memberId,
      doctorProfileId: input.doctorProfileId,
      assessmentHistoryId: input.assessmentHistoryId || null,
      noteType: input.noteType || 'CLINICAL',
      content: input.content.trim(),
    },
  });
}

export async function exportDoctorPatientData(input: {
  doctorProfileId: string;
  memberId: string;
  exportType: string;
  exportRange?: string;
  purpose?: string;
}) {
  await assertDoctorMemberAccess(input.doctorProfileId, input.memberId);

  const consent = await prisma.researchConsent.findUnique({
    where: { memberProfileId: input.memberId },
  });

  if (!consent || consent.status !== 'GRANTED') {
    throw new Error('Research consent is required before exporting data');
  }

  const [member, assessments, notes] = await Promise.all([
    memberProfileModel().findFirst({
      where: { id: input.memberId },
    }),
    prisma.assessmentHistory.findMany({
      where: { profileId: input.memberId },
      orderBy: { createdAt: 'asc' },
      select: {
        scaleId: true,
        scaleVersion: true,
        totalScore: true,
        conclusion: true,
        createdAt: true,
      },
    }),
    prisma.doctorPatientNote.findMany({
      where: {
        doctorProfileId: input.doctorProfileId,
        memberProfileId: input.memberId,
        noteType: 'RESEARCH',
      },
      orderBy: { createdAt: 'asc' },
      select: {
        content: true,
        createdAt: true,
      },
    }),
  ]);

  if (!member) {
    throw new Error('Member not found');
  }

  await prisma.researchExportLog.create({
    data: {
      doctorProfileId: input.doctorProfileId,
      memberProfileId: input.memberId,
      exportType: input.exportType,
      exportRange: input.exportRange || null,
      purpose: input.purpose || null,
    },
  });

  return {
    fileName: `research-export-${buildStudyId(input.memberId)}.csv`,
    csv: [
      ['memberStudyId', 'relation', 'ageMonths', 'gender', 'scaleId', 'scaleVersion', 'totalScore', 'conclusion', 'createdAt', 'doctorResearchNote'].join(','),
      ...assessments.map((assessment, index) =>
        [
          buildStudyId(input.memberId),
          String(member.relation || '').toLowerCase(),
          member.ageMonths ?? '',
          member.gender ?? '',
          assessment.scaleId,
          assessment.scaleVersion,
          assessment.totalScore,
          JSON.stringify(assessment.conclusion),
          assessment.createdAt.toISOString(),
          JSON.stringify(notes[index]?.content || ''),
        ].join(',')
      ),
    ].join('\n'),
  };
}
