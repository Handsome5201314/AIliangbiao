import {
  CareAccessRole,
  CareTeamRole,
  type DoctorProfile,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

export type EffectiveAccessRole = 'OWNER' | 'COLLABORATOR' | 'READONLY';

export type CareTeamSummary = {
  id: string;
  name: string;
  hospitalName: string;
  departmentName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  leadCount: number;
  currentDoctorTeamRole?: CareTeamRole;
};

export type CareTeamMember = {
  doctorProfileId: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  verificationStatus: string;
  teamRole: CareTeamRole;
  createdAt: string;
};

export type MemberAccessGrantView = {
  id: string;
  accessRole: CareAccessRole;
  sourceTeam: CareTeamSummary;
  targetDoctor: {
    doctorProfileId: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  };
  grantedByDoctor: {
    doctorProfileId: string;
    realName: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type TeamShareCandidate = {
  id: string;
  name: string;
  hospitalName: string;
  departmentName: string;
  currentDoctorTeamRole: CareTeamRole;
  members: Array<{
    doctorProfileId: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
    teamRole: CareTeamRole;
  }>;
};

type MemberAccessResolution = {
  memberId: string;
  effectiveAccessRole: EffectiveAccessRole;
  source: 'OWNER' | 'GRANT';
  ownerDoctorProfile: {
    id: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  } | null;
  sourceTeamId?: string | null;
};

function serializeDate(value: Date) {
  return value.toISOString();
}

function mapDoctorSummary(doctorProfile: Pick<DoctorProfile, 'id' | 'realName' | 'hospitalName' | 'departmentName' | 'title'>) {
  return {
    id: doctorProfile.id,
    realName: doctorProfile.realName,
    hospitalName: doctorProfile.hospitalName,
    departmentName: doctorProfile.departmentName,
    title: doctorProfile.title,
  };
}

async function createDoctorCollaborationAuditLog(input: {
  resourceType: 'PATIENT_MEMBER' | 'CARE_TEAM';
  resourceId: string;
  action: string;
  actorDoctorProfileId?: string | null;
  targetDoctorProfileId?: string | null;
  sourceTeamId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.doctorCollaborationAuditLog.create({
    data: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action,
      actorDoctorProfileId: input.actorDoctorProfileId ?? null,
      targetDoctorProfileId: input.targetDoctorProfileId ?? null,
      sourceTeamId: input.sourceTeamId ?? null,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}
async function getDoctorProfileOrThrow(doctorProfileId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
  });

  if (!doctor) {
    throw new Error('未找到医生资料');
  }

  return doctor;
}

async function getTeamMembershipOrThrow(teamId: string, doctorProfileId: string) {
  const membership = await prisma.careTeamMembership.findFirst({
    where: {
      teamId,
      doctorProfileId,
      team: {
        isActive: true,
      },
    },
    include: {
      team: true,
    },
  });

  if (!membership) {
    throw new Error('当前医生不在该团队中');
  }

  return membership;
}

async function assertDoctorIsTeamLead(teamId: string, doctorProfileId: string) {
  const membership = await getTeamMembershipOrThrow(teamId, doctorProfileId);
  if (membership.teamRole !== 'LEAD') {
    throw new Error('只有团队负责人可以维护团队成员');
  }
  return membership;
}

function ensureDoctorMatchesTeamBoundary(
  doctor: Pick<DoctorProfile, 'hospitalName' | 'departmentName'>,
  team: Pick<{ hospitalName: string; departmentName: string }, 'hospitalName' | 'departmentName'>,
) {
  if (doctor.hospitalName !== team.hospitalName || doctor.departmentName !== team.departmentName) {
    throw new Error('医生必须与团队处于同医院同科室');
  }
}

function serializeTeamSummary(team: {
  id: string;
  name: string;
  hospitalName: string;
  departmentName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberships: Array<{ teamRole: CareTeamRole }>;
}) {
  const leadCount = team.memberships.filter((item) => item.teamRole === 'LEAD').length;

  return {
    id: team.id,
    name: team.name,
    hospitalName: team.hospitalName,
    departmentName: team.departmentName,
    isActive: team.isActive,
    createdAt: serializeDate(team.createdAt),
    updatedAt: serializeDate(team.updatedAt),
    memberCount: team.memberships.length,
    leadCount,
  } satisfies CareTeamSummary;
}

function serializeTeamMember(item: {
  doctorProfile: Pick<DoctorProfile, 'id' | 'realName' | 'hospitalName' | 'departmentName' | 'title' | 'verificationStatus'>;
  teamRole: CareTeamRole;
  createdAt: Date;
}) {
  return {
    doctorProfileId: item.doctorProfile.id,
    realName: item.doctorProfile.realName,
    hospitalName: item.doctorProfile.hospitalName,
    departmentName: item.doctorProfile.departmentName,
    title: item.doctorProfile.title,
    verificationStatus: item.doctorProfile.verificationStatus,
    teamRole: item.teamRole,
    createdAt: serializeDate(item.createdAt),
  } satisfies CareTeamMember;
}

export async function listCareTeamsForAdmin() {
  const teams = await prisma.careTeam.findMany({
    include: {
      memberships: {
        select: {
          teamRole: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });

  return teams.map(serializeTeamSummary);
}

export async function createCareTeam(input: {
  adminId: string;
  name: string;
  hospitalName: string;
  departmentName: string;
  leadDoctorProfileId: string;
}) {
  const leadDoctor = await getDoctorProfileOrThrow(input.leadDoctorProfileId);
  if (leadDoctor.verificationStatus !== 'APPROVED') {
    throw new Error('负责人医生必须处于审核通过状态');
  }
  ensureDoctorMatchesTeamBoundary(leadDoctor, input);

  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.careTeam.create({
      data: {
        name: input.name.trim(),
        hospitalName: input.hospitalName.trim(),
        departmentName: input.departmentName.trim(),
        createdByAdminId: input.adminId,
      },
      include: {
        memberships: true,
      },
    });

    await tx.careTeamMembership.create({
      data: {
        teamId: created.id,
        doctorProfileId: input.leadDoctorProfileId,
        teamRole: 'LEAD',
      },
    });

    return tx.careTeam.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        memberships: {
          select: {
            teamRole: true,
          },
        },
      },
    });
  });

  return serializeTeamSummary(team);
}

export async function updateCareTeam(input: {
  teamId: string;
  name?: string;
  hospitalName?: string;
  departmentName?: string;
  isActive?: boolean;
}) {
  const existing = await prisma.careTeam.findUnique({
    where: { id: input.teamId },
    include: {
      memberships: {
        include: {
          doctorProfile: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('未找到团队');
  }

  const nextHospitalName = input.hospitalName?.trim() || existing.hospitalName;
  const nextDepartmentName = input.departmentName?.trim() || existing.departmentName;

  for (const membership of existing.memberships) {
    ensureDoctorMatchesTeamBoundary(membership.doctorProfile, {
      hospitalName: nextHospitalName,
      departmentName: nextDepartmentName,
    });
  }

  const updated = await prisma.careTeam.update({
    where: { id: input.teamId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.hospitalName !== undefined ? { hospitalName: nextHospitalName } : {}),
      ...(input.departmentName !== undefined ? { departmentName: nextDepartmentName } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      memberships: {
        select: {
          teamRole: true,
        },
      },
    },
  });

  return serializeTeamSummary(updated);
}

export async function listCareTeamMembers(teamId: string) {
  const memberships = await prisma.careTeamMembership.findMany({
    where: { teamId },
    include: {
      doctorProfile: true,
    },
    orderBy: [{ teamRole: 'asc' }, { createdAt: 'asc' }],
  });

  return memberships.map(serializeTeamMember);
}

export async function adminAddDoctorToCareTeam(input: {
  teamId: string;
  targetDoctorProfileId: string;
  teamRole: CareTeamRole;
}) {
  const team = await prisma.careTeam.findUnique({
    where: { id: input.teamId },
  });

  if (!team || !team.isActive) {
    throw new Error('未找到可用的团队');
  }

  const targetDoctor = await getDoctorProfileOrThrow(input.targetDoctorProfileId);
  if (targetDoctor.verificationStatus !== 'APPROVED') {
    throw new Error('只能将审核通过的医生加入团队');
  }

  ensureDoctorMatchesTeamBoundary(targetDoctor, team);

  const existing = await prisma.careTeamMembership.findUnique({
    where: {
      teamId_doctorProfileId: {
        teamId: input.teamId,
        doctorProfileId: input.targetDoctorProfileId,
      },
    },
  });

  const membership = existing
    ? await prisma.careTeamMembership.update({
        where: {
          teamId_doctorProfileId: {
            teamId: input.teamId,
            doctorProfileId: input.targetDoctorProfileId,
          },
        },
        data: {
          teamRole: input.teamRole,
        },
        include: {
          doctorProfile: true,
        },
      })
    : await prisma.careTeamMembership.create({
        data: {
          teamId: input.teamId,
          doctorProfileId: input.targetDoctorProfileId,
          teamRole: input.teamRole,
        },
        include: {
          doctorProfile: true,
        },
      });

  await createDoctorCollaborationAuditLog({
    resourceType: 'CARE_TEAM',
    resourceId: input.teamId,
    action: existing ? 'TEAM_MEMBER_ROLE_UPDATED' : 'TEAM_MEMBER_ADDED',
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.teamId,
    metadata: {
      teamRole: input.teamRole,
      createdBy: 'admin',
    },
  });

  return serializeTeamMember(membership);
}

export async function listDoctorTeams(doctorProfileId: string) {
  const memberships = await prisma.careTeamMembership.findMany({
    where: {
      doctorProfileId,
      team: {
        isActive: true,
      },
    },
    include: {
      team: {
        include: {
          memberships: {
            select: {
              teamRole: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return memberships.map((membership) => ({
    ...serializeTeamSummary(membership.team),
    currentDoctorTeamRole: membership.teamRole,
  }));
}

export async function listDoctorTeamMembers(teamId: string, doctorProfileId: string) {
  const membership = await getTeamMembershipOrThrow(teamId, doctorProfileId);
  const members = await listCareTeamMembers(teamId);

  return {
    team: {
      id: membership.team.id,
      name: membership.team.name,
      hospitalName: membership.team.hospitalName,
      departmentName: membership.team.departmentName,
      isActive: membership.team.isActive,
      createdAt: serializeDate(membership.team.createdAt),
      updatedAt: serializeDate(membership.team.updatedAt),
      memberCount: members.length,
      leadCount: members.filter((item) => item.teamRole === 'LEAD').length,
      currentDoctorTeamRole: membership.teamRole,
    } satisfies CareTeamSummary,
    members,
  };
}

export async function addDoctorToCareTeam(input: {
  actorDoctorProfileId: string;
  teamId: string;
  targetDoctorProfileId: string;
  teamRole: CareTeamRole;
}) {
  const actorMembership = await assertDoctorIsTeamLead(input.teamId, input.actorDoctorProfileId);
  const targetDoctor = await getDoctorProfileOrThrow(input.targetDoctorProfileId);

  if (targetDoctor.verificationStatus !== 'APPROVED') {
    throw new Error('只能将审核通过的医生加入团队');
  }
  ensureDoctorMatchesTeamBoundary(targetDoctor, actorMembership.team);

  const existing = await prisma.careTeamMembership.findUnique({
    where: {
      teamId_doctorProfileId: {
        teamId: input.teamId,
        doctorProfileId: input.targetDoctorProfileId,
      },
    },
  });

  const membership = existing
    ? await prisma.careTeamMembership.update({
        where: {
          teamId_doctorProfileId: {
            teamId: input.teamId,
            doctorProfileId: input.targetDoctorProfileId,
          },
        },
        data: {
          teamRole: input.teamRole,
        },
        include: {
          doctorProfile: true,
        },
      })
    : await prisma.careTeamMembership.create({
        data: {
          teamId: input.teamId,
          doctorProfileId: input.targetDoctorProfileId,
          teamRole: input.teamRole,
        },
        include: {
          doctorProfile: true,
        },
      });

  await createDoctorCollaborationAuditLog({
    resourceType: 'CARE_TEAM',
    resourceId: input.teamId,
    action: existing ? 'TEAM_MEMBER_ROLE_UPDATED' : 'TEAM_MEMBER_ADDED',
    actorDoctorProfileId: input.actorDoctorProfileId,
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.teamId,
    metadata: {
      teamRole: input.teamRole,
    },
  });

  return serializeTeamMember(membership);
}

export async function updateCareTeamMemberRole(input: {
  actorDoctorProfileId: string;
  teamId: string;
  targetDoctorProfileId: string;
  teamRole: CareTeamRole;
}) {
  await assertDoctorIsTeamLead(input.teamId, input.actorDoctorProfileId);
  const membership = await prisma.careTeamMembership.findUnique({
    where: {
      teamId_doctorProfileId: {
        teamId: input.teamId,
        doctorProfileId: input.targetDoctorProfileId,
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  if (!membership) {
    throw new Error('未找到团队成员');
  }

  if (membership.teamRole === 'LEAD' && input.teamRole !== 'LEAD') {
    const leadCount = await prisma.careTeamMembership.count({
      where: {
        teamId: input.teamId,
        teamRole: 'LEAD',
      },
    });

    if (leadCount <= 1) {
      throw new Error('系统不允许移除最后一个负责人');
    }
  }

  const updated = await prisma.careTeamMembership.update({
    where: {
      teamId_doctorProfileId: {
        teamId: input.teamId,
        doctorProfileId: input.targetDoctorProfileId,
      },
    },
    data: {
      teamRole: input.teamRole,
    },
    include: {
      doctorProfile: true,
    },
  });

  await createDoctorCollaborationAuditLog({
    resourceType: 'CARE_TEAM',
    resourceId: input.teamId,
    action: 'TEAM_MEMBER_ROLE_UPDATED',
    actorDoctorProfileId: input.actorDoctorProfileId,
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.teamId,
    metadata: {
      teamRole: input.teamRole,
    },
  });

  return serializeTeamMember(updated);
}

export async function removeDoctorFromCareTeam(input: {
  actorDoctorProfileId: string;
  teamId: string;
  targetDoctorProfileId: string;
}) {
  await assertDoctorIsTeamLead(input.teamId, input.actorDoctorProfileId);
  const membership = await prisma.careTeamMembership.findUnique({
    where: {
      teamId_doctorProfileId: {
        teamId: input.teamId,
        doctorProfileId: input.targetDoctorProfileId,
      },
    },
  });

  if (!membership) {
    throw new Error('未找到团队成员');
  }

  if (membership.teamRole === 'LEAD') {
    const leadCount = await prisma.careTeamMembership.count({
      where: {
        teamId: input.teamId,
        teamRole: 'LEAD',
      },
    });

    if (leadCount <= 1) {
      throw new Error('系统不允许移除最后一个负责人');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.careTeamMembership.delete({
      where: {
        teamId_doctorProfileId: {
          teamId: input.teamId,
          doctorProfileId: input.targetDoctorProfileId,
        },
      },
    });

    const now = new Date();
    await tx.memberCareAccessGrant.updateMany({
      where: {
        doctorProfileId: input.targetDoctorProfileId,
        sourceTeamId: input.teamId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

  });

  await createDoctorCollaborationAuditLog({
    resourceType: 'CARE_TEAM',
    resourceId: input.teamId,
    action: 'TEAM_MEMBER_REMOVED',
    actorDoctorProfileId: input.actorDoctorProfileId,
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.teamId,
  });

  return { success: true };
}

export async function adminRemoveDoctorFromCareTeam(input: {
  teamId: string;
  targetDoctorProfileId: string;
}) {
  const membership = await prisma.careTeamMembership.findUnique({
    where: {
      teamId_doctorProfileId: {
        teamId: input.teamId,
        doctorProfileId: input.targetDoctorProfileId,
      },
    },
  });

  if (!membership) {
    throw new Error('未找到团队成员');
  }

  if (membership.teamRole === 'LEAD') {
    const leadCount = await prisma.careTeamMembership.count({
      where: {
        teamId: input.teamId,
        teamRole: 'LEAD',
      },
    });

    if (leadCount <= 1) {
      throw new Error('系统不允许移除最后一个负责人');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.careTeamMembership.delete({
      where: {
        teamId_doctorProfileId: {
          teamId: input.teamId,
          doctorProfileId: input.targetDoctorProfileId,
        },
      },
    });

    const now = new Date();
    await tx.memberCareAccessGrant.updateMany({
      where: {
        doctorProfileId: input.targetDoctorProfileId,
        sourceTeamId: input.teamId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

  });

  await createDoctorCollaborationAuditLog({
    resourceType: 'CARE_TEAM',
    resourceId: input.teamId,
    action: 'TEAM_MEMBER_REMOVED',
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.teamId,
    metadata: {
      createdBy: 'admin',
    },
  });

  return { success: true };
}

export async function assertDoctorProfileBoundaryChangeAllowed(input: {
  doctorProfileId: string;
  nextHospitalName?: string;
  nextDepartmentName?: string;
}) {
  const doctor = await getDoctorProfileOrThrow(input.doctorProfileId);
  const nextHospitalName = input.nextHospitalName ?? doctor.hospitalName;
  const nextDepartmentName = input.nextDepartmentName ?? doctor.departmentName;

  const memberships = await prisma.careTeamMembership.findMany({
    where: {
      doctorProfileId: input.doctorProfileId,
      team: {
        isActive: true,
      },
    },
    include: {
      team: true,
    },
  });

  const invalid = memberships.find(
    (membership) =>
      membership.team.hospitalName !== nextHospitalName ||
      membership.team.departmentName !== nextDepartmentName,
  );

  if (invalid) {
    throw new Error('医生已加入激活团队，医院或科室信息不能直接修改；请先移出团队或由管理员处理转移');
  }
}

export async function listShareableTeamsForDoctor(doctorProfileId: string): Promise<TeamShareCandidate[]> {
  const memberships = await prisma.careTeamMembership.findMany({
    where: {
      doctorProfileId,
      team: {
        isActive: true,
      },
    },
    include: {
      team: {
        include: {
          memberships: {
            include: {
              doctorProfile: true,
            },
            orderBy: [{ teamRole: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
    hospitalName: membership.team.hospitalName,
    departmentName: membership.team.departmentName,
    currentDoctorTeamRole: membership.teamRole,
    members: membership.team.memberships
      .filter((item) => item.doctorProfileId !== doctorProfileId)
      .map((item) => ({
        doctorProfileId: item.doctorProfile.id,
        realName: item.doctorProfile.realName,
        hospitalName: item.doctorProfile.hospitalName,
        departmentName: item.doctorProfile.departmentName,
        title: item.doctorProfile.title,
        teamRole: item.teamRole,
      })),
  }));
}

async function getActiveMemberOwner(memberId: string) {
  return prisma.careAssignment.findFirst({
    where: {
      memberProfileId: memberId,
      status: 'ACTIVE',
    },
    include: {
      doctorProfile: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function resolveDoctorMemberAccess(memberId: string, doctorProfileId: string): Promise<MemberAccessResolution | null> {
  const ownerAssignment = await getActiveMemberOwner(memberId);

  if (ownerAssignment?.doctorProfileId === doctorProfileId) {
    return {
      memberId,
      effectiveAccessRole: 'OWNER',
      source: 'OWNER',
      ownerDoctorProfile: mapDoctorSummary(ownerAssignment.doctorProfile),
    };
  }

  const grant = await prisma.memberCareAccessGrant.findFirst({
    where: {
      memberProfileId: memberId,
      doctorProfileId,
      revokedAt: null,
      sourceTeam: {
        isActive: true,
        memberships: {
          some: {
            doctorProfileId,
          },
        },
      },
    },
    include: {
      sourceTeam: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!grant) {
    return null;
  }

  return {
    memberId,
    effectiveAccessRole: grant.accessRole === 'COLLABORATOR' ? 'COLLABORATOR' : 'READONLY',
    source: 'GRANT',
    ownerDoctorProfile: ownerAssignment ? mapDoctorSummary(ownerAssignment.doctorProfile) : null,
    sourceTeamId: grant.sourceTeamId,
  };
}

export async function assertDoctorCanAccessMember(memberId: string, doctorProfileId: string) {
  const access = await resolveDoctorMemberAccess(memberId, doctorProfileId);
  if (!access) {
    throw new Error('当前医生无权访问该患者档案');
  }
  return access;
}

export async function assertDoctorCanWriteMember(memberId: string, doctorProfileId: string) {
  const access = await assertDoctorCanAccessMember(memberId, doctorProfileId);
  if (access.effectiveAccessRole === 'READONLY') {
    throw new Error('只读协作者不能修改该患者档案');
  }
  return access;
}

export async function assertDoctorOwnsMember(memberId: string, doctorProfileId: string) {
  const access = await assertDoctorCanAccessMember(memberId, doctorProfileId);
  if (access.effectiveAccessRole !== 'OWNER') {
    throw new Error('只有主责任医生可以管理该患者的共享权限');
  }
  return access;
}

function serializeMemberGrant(grant: {
  id: string;
  accessRole: CareAccessRole;
  sourceTeam: {
    id: string;
    name: string;
    hospitalName: string;
    departmentName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    memberships: Array<{ teamRole: CareTeamRole }>;
  };
  doctorProfile: Pick<DoctorProfile, 'id' | 'realName' | 'hospitalName' | 'departmentName' | 'title'>;
  grantedByDoctorProfile: Pick<DoctorProfile, 'id' | 'realName'>;
  createdAt: Date;
  updatedAt: Date;
}): MemberAccessGrantView {
  return {
    id: grant.id,
    accessRole: grant.accessRole,
    sourceTeam: serializeTeamSummary(grant.sourceTeam),
    targetDoctor: {
      doctorProfileId: grant.doctorProfile.id,
      realName: grant.doctorProfile.realName,
      hospitalName: grant.doctorProfile.hospitalName,
      departmentName: grant.doctorProfile.departmentName,
      title: grant.doctorProfile.title,
    },
    grantedByDoctor: {
      doctorProfileId: grant.grantedByDoctorProfile.id,
      realName: grant.grantedByDoctorProfile.realName,
    },
    createdAt: serializeDate(grant.createdAt),
    updatedAt: serializeDate(grant.updatedAt),
  };
}

export async function listMemberAccessOverview(memberId: string, doctorProfileId: string) {
  const access = await assertDoctorCanAccessMember(memberId, doctorProfileId);
  const ownerAssignment = await getActiveMemberOwner(memberId);
  const grants = await prisma.memberCareAccessGrant.findMany({
    where: {
      memberProfileId: memberId,
      revokedAt: null,
    },
    include: {
      sourceTeam: {
        include: {
          memberships: {
            select: {
              teamRole: true,
            },
          },
        },
      },
      doctorProfile: true,
      grantedByDoctorProfile: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const activeGrants = grants.filter((grant) => grant.sourceTeam.isActive);
  const shareableTeams = access.effectiveAccessRole === 'OWNER' ? await listShareableTeamsForDoctor(doctorProfileId) : [];

  return {
    effectiveAccessRole: access.effectiveAccessRole,
    ownerDoctorProfile: ownerAssignment ? mapDoctorSummary(ownerAssignment.doctorProfile) : null,
    grants: activeGrants.map(serializeMemberGrant),
    shareableTeams,
  };
}

async function assertGrantDoctorsInSameTeam(input: {
  actorDoctorProfileId: string;
  targetDoctorProfileId: string;
  sourceTeamId: string;
}) {
  const actorMembership = await getTeamMembershipOrThrow(input.sourceTeamId, input.actorDoctorProfileId);
  const targetMembership = await prisma.careTeamMembership.findFirst({
    where: {
      teamId: input.sourceTeamId,
      doctorProfileId: input.targetDoctorProfileId,
      team: {
        isActive: true,
      },
    },
  });

  if (!targetMembership) {
    throw new Error('目标医生不在所选团队中');
  }

  return actorMembership;
}

export async function createMemberAccessGrant(input: {
  ownerDoctorProfileId: string;
  memberId: string;
  targetDoctorProfileId: string;
  sourceTeamId: string;
  accessRole: CareAccessRole;
}) {
  await assertDoctorOwnsMember(input.memberId, input.ownerDoctorProfileId);
  await assertGrantDoctorsInSameTeam({
    actorDoctorProfileId: input.ownerDoctorProfileId,
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.sourceTeamId,
  });

  if (input.ownerDoctorProfileId === input.targetDoctorProfileId) {
    throw new Error('不能把患者共享给自己');
  }

  const existing = await prisma.memberCareAccessGrant.findFirst({
    where: {
      memberProfileId: input.memberId,
      doctorProfileId: input.targetDoctorProfileId,
      revokedAt: null,
    },
  });

  if (
    existing &&
    existing.sourceTeamId === input.sourceTeamId &&
    existing.accessRole === input.accessRole
  ) {
    const grant = await prisma.memberCareAccessGrant.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        sourceTeam: {
          include: {
            memberships: {
              select: {
                teamRole: true,
              },
            },
          },
        },
        doctorProfile: true,
        grantedByDoctorProfile: true,
      },
    });
    return serializeMemberGrant(grant);
  }

  const grant = await prisma.$transaction(async (tx) => {
    await tx.memberCareAccessGrant.updateMany({
      where: {
        memberProfileId: input.memberId,
        doctorProfileId: input.targetDoctorProfileId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return tx.memberCareAccessGrant.create({
      data: {
        memberProfileId: input.memberId,
        doctorProfileId: input.targetDoctorProfileId,
        sourceTeamId: input.sourceTeamId,
        accessRole: input.accessRole,
        grantedByDoctorProfileId: input.ownerDoctorProfileId,
      },
      include: {
        sourceTeam: {
          include: {
            memberships: {
              select: {
                teamRole: true,
              },
            },
          },
        },
        doctorProfile: true,
        grantedByDoctorProfile: true,
      },
    });
  });

  await createDoctorCollaborationAuditLog({
    resourceType: 'PATIENT_MEMBER',
    resourceId: input.memberId,
    action: 'MEMBER_ACCESS_GRANTED',
    actorDoctorProfileId: input.ownerDoctorProfileId,
    targetDoctorProfileId: input.targetDoctorProfileId,
    sourceTeamId: input.sourceTeamId,
    metadata: {
      accessRole: input.accessRole,
    },
  });

  return serializeMemberGrant(grant);
}

export async function updateMemberAccessGrant(input: {
  ownerDoctorProfileId: string;
  grantId: string;
  accessRole: CareAccessRole;
}) {
  const grant = await prisma.memberCareAccessGrant.findUnique({
    where: { id: input.grantId },
    include: {
      sourceTeam: {
        include: {
          memberships: {
            select: {
              teamRole: true,
            },
          },
        },
      },
      doctorProfile: true,
      grantedByDoctorProfile: true,
    },
  });

  if (!grant || grant.revokedAt) {
    throw new Error('未找到有效的患者共享授权');
  }

  await assertDoctorOwnsMember(grant.memberProfileId, input.ownerDoctorProfileId);

  const updated = await prisma.memberCareAccessGrant.update({
    where: { id: input.grantId },
    data: {
      accessRole: input.accessRole,
    },
    include: {
      sourceTeam: {
        include: {
          memberships: {
            select: {
              teamRole: true,
            },
          },
        },
      },
      doctorProfile: true,
      grantedByDoctorProfile: true,
    },
  });

  await createDoctorCollaborationAuditLog({
    resourceType: 'PATIENT_MEMBER',
    resourceId: grant.memberProfileId,
    action: 'MEMBER_ACCESS_ROLE_UPDATED',
    actorDoctorProfileId: input.ownerDoctorProfileId,
    targetDoctorProfileId: grant.doctorProfileId,
    sourceTeamId: grant.sourceTeamId,
    metadata: {
      accessRole: input.accessRole,
    },
  });

  return serializeMemberGrant(updated);
}

export async function revokeMemberAccessGrant(input: {
  ownerDoctorProfileId: string;
  grantId: string;
}) {
  const grant = await prisma.memberCareAccessGrant.findUnique({
    where: { id: input.grantId },
  });

  if (!grant || grant.revokedAt) {
    throw new Error('未找到有效的患者共享授权');
  }

  await assertDoctorOwnsMember(grant.memberProfileId, input.ownerDoctorProfileId);

  const revoked = await prisma.memberCareAccessGrant.update({
    where: { id: input.grantId },
    data: {
      revokedAt: new Date(),
    },
    include: {
      sourceTeam: {
        include: {
          memberships: {
            select: {
              teamRole: true,
            },
          },
        },
      },
      doctorProfile: true,
      grantedByDoctorProfile: true,
    },
  });

  await createDoctorCollaborationAuditLog({
    resourceType: 'PATIENT_MEMBER',
    resourceId: grant.memberProfileId,
    action: 'MEMBER_ACCESS_REVOKED',
    actorDoctorProfileId: input.ownerDoctorProfileId,
    targetDoctorProfileId: grant.doctorProfileId,
    sourceTeamId: grant.sourceTeamId,
  });

  return serializeMemberGrant(revoked);
}

export async function listAccessibleMemberRoles(doctorProfileId: string) {
  const ownedAssignments = await prisma.careAssignment.findMany({
    where: {
      doctorProfileId,
      status: 'ACTIVE',
    },
    select: {
      memberProfileId: true,
    },
  });

  const sharedGrants = await prisma.memberCareAccessGrant.findMany({
    where: {
      doctorProfileId,
      revokedAt: null,
      sourceTeam: {
        isActive: true,
        memberships: {
          some: {
            doctorProfileId,
          },
        },
      },
    },
    include: {
      memberProfile: {
        include: {
          careAssignments: {
            where: { status: 'ACTIVE' },
            include: {
              doctorProfile: true,
            },
            take: 1,
            orderBy: { updatedAt: 'desc' },
          },
        },
      },
    },
  });

  const roleMap = new Map<
    string,
    {
      memberId: string;
      effectiveAccessRole: EffectiveAccessRole;
      source: 'OWNER' | 'GRANT';
    }
  >();

  for (const assignment of ownedAssignments) {
    roleMap.set(assignment.memberProfileId, {
      memberId: assignment.memberProfileId,
      effectiveAccessRole: 'OWNER',
      source: 'OWNER',
    });
  }

  for (const grant of sharedGrants) {
    if (!grant.memberProfile.careAssignments.length) {
      continue;
    }

    const current = roleMap.get(grant.memberProfileId);
    if (current?.effectiveAccessRole === 'OWNER') {
      continue;
    }

    roleMap.set(grant.memberProfileId, {
      memberId: grant.memberProfileId,
      effectiveAccessRole: grant.accessRole === 'COLLABORATOR' ? 'COLLABORATOR' : 'READONLY',
      source: 'GRANT',
    });
  }

  return Array.from(roleMap.values());
}

export async function revokeActiveMemberAccessGrantsForMember(memberId: string) {
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

export async function logPatientWriteAction(input: {
  actorDoctorProfileId: string;
  memberId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  return createDoctorCollaborationAuditLog({
    resourceType: 'PATIENT_MEMBER',
    resourceId: input.memberId,
    action: input.action,
    actorDoctorProfileId: input.actorDoctorProfileId,
    metadata: input.metadata,
  });
}
