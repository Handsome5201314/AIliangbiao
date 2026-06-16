import { prisma } from "@/lib/db/prisma";

export type AdminHermesProfileStatus = "DRAFT" | "READY" | "DEGRADED" | "DISABLED";
export type AdminHermesProfileStatusFilter = "ALL" | AdminHermesProfileStatus;
export type AdminHermesProfileOwnerType = "ORGANIZATION" | "DOCTOR";
export type AdminHermesProfileOwnerTypeFilter = "ALL" | AdminHermesProfileOwnerType;
export type AdminHermesKnowledgeDefaultMode = "platform_proxy" | "direct_fastgpt";

type ListAdminHermesProfilesInput = {
  status?: AdminHermesProfileStatusFilter;
  ownerType?: AdminHermesProfileOwnerTypeFilter;
  query?: string;
};

type SaveAdminHermesProfileInput = {
  ownerType: AdminHermesProfileOwnerType;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  displayName?: string | null;
  status?: AdminHermesProfileStatus;
  policyJson?: Record<string, unknown> | null;
  configJson?: Record<string, unknown> | null;
  knowledgeDefaultMode?: AdminHermesKnowledgeDefaultMode;
  doctorBotFallbackEnabled?: boolean;
  lastHealthAt?: string | Date | null;
};

type UpdateAdminHermesProfileInput = {
  displayName?: string | null;
  status?: AdminHermesProfileStatus;
  policyJson?: Record<string, unknown> | null;
  configJson?: Record<string, unknown> | null;
  knowledgeDefaultMode?: AdminHermesKnowledgeDefaultMode;
  doctorBotFallbackEnabled?: boolean;
  lastHealthAt?: string | Date | null;
};

type AuditPayload = {
  adminId?: string | null;
  action: string;
  targetId: string;
  organizationId?: string | null;
  details: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Hermes Profile 健康时间格式无效");
  }

  return date;
}

function readHermesRuntimeConfig(configJson: unknown) {
  const raw = isPlainObject(configJson) ? { ...configJson } : {};

  return {
    raw,
    knowledgeDefaultMode:
      raw.knowledgeDefaultMode === "direct_fastgpt"
        ? ("direct_fastgpt" as const)
        : ("platform_proxy" as const),
    doctorBotFallbackEnabled: raw.doctorBotFallbackEnabled !== false,
  };
}

function buildHermesProfileConfig(input: {
  configJson?: Record<string, unknown> | null;
  knowledgeDefaultMode?: AdminHermesKnowledgeDefaultMode;
  doctorBotFallbackEnabled?: boolean;
}) {
  const current = readHermesRuntimeConfig(input.configJson);

  return {
    ...current.raw,
    knowledgeDefaultMode: input.knowledgeDefaultMode ?? current.knowledgeDefaultMode,
    doctorBotFallbackEnabled:
      input.doctorBotFallbackEnabled ?? current.doctorBotFallbackEnabled,
  };
}

function getOrganizationModel() {
  const organizationModel = (prisma as any).organization;
  if (!organizationModel?.findMany || !organizationModel?.findUnique) {
    throw new Error("Organization model is not available");
  }

  return organizationModel;
}

function getHermesProfileModel() {
  const hermesProfileModel = (prisma as any).hermesProfile;
  if (!hermesProfileModel?.findMany || !hermesProfileModel?.findUnique) {
    throw new Error("HermesProfile model is not available");
  }

  return hermesProfileModel;
}

async function recordHermesProfileAudit(input: AuditPayload) {
  const auditLogModel = (prisma as any).auditLog;
  if (!auditLogModel?.create || !input.adminId) {
    return;
  }

  await auditLogModel.create({
    data: {
      organizationId: input.organizationId || null,
      actorType: "ADMIN",
      actorAdminId: input.adminId,
      targetType: "HERMES_PROFILE",
      targetId: input.targetId,
      action: input.action,
      details: input.details,
    },
  });
}

function toHermesProfileView(record: any) {
  const runtime = readHermesRuntimeConfig(record.configJson);

  return {
    id: record.id,
    ownerType: record.ownerType as AdminHermesProfileOwnerType,
    organizationId: record.organizationId || null,
    organizationName: record.organization?.name || null,
    organizationCode: record.organization?.orgCode || null,
    doctorProfileId: record.doctorProfileId || null,
    doctorName: record.doctorProfile?.realName || null,
    doctorHospitalName: record.doctorProfile?.hospitalName || null,
    displayName: record.displayName || null,
    status: record.status as AdminHermesProfileStatus,
    policyJson: isPlainObject(record.policyJson) ? record.policyJson : null,
    configJson: isPlainObject(record.configJson) ? record.configJson : null,
    knowledgeDefaultMode: runtime.knowledgeDefaultMode,
    doctorBotFallbackEnabled: runtime.doctorBotFallbackEnabled,
    knowledgeDocCount: record._count?.knowledgeDocs || 0,
    lastHealthAt: record.lastHealthAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function listOrganizationCandidates() {
  const organizationModel = getOrganizationModel();
  const organizations = await organizationModel.findMany({
    where: {
      status: "READY",
      hermesProfiles: {
        none: {},
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      orgCode: true,
      status: true,
      _count: {
        select: {
          doctors: true,
        },
      },
    },
  });

  return organizations.map((organization: any) => ({
    id: organization.id,
    name: organization.name,
    orgCode: organization.orgCode || null,
    status: organization.status,
    doctorCount: organization._count?.doctors || 0,
  }));
}

async function listDoctorCandidates() {
  const doctors = await prisma.doctorProfile.findMany({
    where: {
      verificationStatus: "APPROVED",
      organizationId: null,
      hermesProfile: {
        is: null,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      realName: true,
      hospitalName: true,
      title: true,
      licenseNo: true,
      verificationStatus: true,
    },
  });

  return doctors.map((doctor) => ({
    id: doctor.id,
    realName: doctor.realName,
    hospitalName: doctor.hospitalName,
    title: doctor.title,
    licenseNo: doctor.licenseNo,
    verificationStatus: doctor.verificationStatus,
  }));
}

async function assertOrganizationOwnerEligible(organizationId: string) {
  const organizationModel = getOrganizationModel();
  const hermesProfileModel = getHermesProfileModel();

  const organization = await organizationModel.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      orgCode: true,
      status: true,
    },
  });

  if (!organization) {
    throw new Error("组织不存在");
  }

  const existing = await hermesProfileModel.findFirst({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) {
    throw new Error("该组织已存在 Hermes Profile");
  }

  return organization;
}

async function assertDoctorOwnerEligible(doctorProfileId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    select: {
      id: true,
      organizationId: true,
      verificationStatus: true,
      realName: true,
      hospitalName: true,
      hermesProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!doctor) {
    throw new Error("医生档案不存在");
  }

  if (doctor.organizationId) {
    throw new Error("归属组织的医生必须继承组织级 Hermes Profile，不能单独创建个人 Profile");
  }

  if (doctor.verificationStatus !== "APPROVED") {
    throw new Error("只有已审核通过的独立医生才能创建个人 Hermes Profile");
  }

  if (doctor.hermesProfile?.id) {
    throw new Error("该医生已存在 Hermes Profile");
  }

  return doctor;
}

export async function listAdminHermesProfiles(
  input: ListAdminHermesProfilesInput = {}
) {
  const hermesProfileModel = getHermesProfileModel();
  const query = input.query?.trim();

  const profiles = await hermesProfileModel.findMany({
    where: {
      ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
      ...(input.ownerType && input.ownerType !== "ALL" ? { ownerType: input.ownerType } : {}),
      ...(query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { organization: { name: { contains: query, mode: "insensitive" } } },
              { organization: { orgCode: { contains: query, mode: "insensitive" } } },
              { doctorProfile: { realName: { contains: query, mode: "insensitive" } } },
              { doctorProfile: { hospitalName: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      ownerType: true,
      organizationId: true,
      doctorProfileId: true,
      displayName: true,
      status: true,
      policyJson: true,
      configJson: true,
      lastHealthAt: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          orgCode: true,
          status: true,
        },
      },
      doctorProfile: {
        select: {
          id: true,
          realName: true,
          hospitalName: true,
        },
      },
      _count: {
        select: {
          knowledgeDocs: true,
        },
      },
    },
  });

  const [organizationCandidates, doctorCandidates] = await Promise.all([
    listOrganizationCandidates(),
    listDoctorCandidates(),
  ]);

  return {
    profiles: profiles.map(toHermesProfileView),
    organizationCandidates,
    doctorCandidates,
  };
}

export async function createAdminHermesProfile(
  input: SaveAdminHermesProfileInput & { adminId?: string | null }
) {
  const hermesProfileModel = getHermesProfileModel();
  const status = input.status || "READY";
  const lastHealthAt = normalizeOptionalDate(input.lastHealthAt);
  const displayName = normalizeOptionalText(input.displayName);
  const policyJson = isPlainObject(input.policyJson) ? input.policyJson : null;
  const configJson = buildHermesProfileConfig({
    configJson: isPlainObject(input.configJson) ? input.configJson : null,
    knowledgeDefaultMode: input.knowledgeDefaultMode,
    doctorBotFallbackEnabled: input.doctorBotFallbackEnabled,
  });

  if (input.ownerType === "ORGANIZATION") {
    if (!input.organizationId) {
      throw new Error("缺少组织 ID");
    }

    const organization = await assertOrganizationOwnerEligible(input.organizationId);
    const created = await hermesProfileModel.create({
      data: {
        ownerType: "ORGANIZATION",
        organizationId: organization.id,
        displayName: displayName || `${organization.name} Hermes Profile`,
        status,
        policyJson,
        configJson,
        lastHealthAt,
      },
      select: {
        id: true,
        ownerType: true,
        organizationId: true,
        doctorProfileId: true,
        displayName: true,
        status: true,
        policyJson: true,
        configJson: true,
        lastHealthAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            orgCode: true,
            status: true,
          },
        },
        doctorProfile: {
          select: {
            id: true,
            realName: true,
            hospitalName: true,
          },
        },
        _count: {
          select: {
            knowledgeDocs: true,
          },
        },
      },
    });

    await recordHermesProfileAudit({
      adminId: input.adminId,
      action: "HERMES_PROFILE_CREATED",
      targetId: created.id,
      organizationId: organization.id,
      details: {
        ownerType: created.ownerType,
        displayName: created.displayName,
        status: created.status,
        knowledgeDefaultMode: configJson.knowledgeDefaultMode,
        doctorBotFallbackEnabled: configJson.doctorBotFallbackEnabled,
      },
    });

    return toHermesProfileView(created);
  }

  if (!input.doctorProfileId) {
    throw new Error("缺少医生档案 ID");
  }

  const doctor = await assertDoctorOwnerEligible(input.doctorProfileId);
  const created = await hermesProfileModel.create({
    data: {
      ownerType: "DOCTOR",
      doctorProfileId: doctor.id,
      displayName: displayName || `${doctor.realName} Hermes Profile`,
      status,
      policyJson,
      configJson,
      lastHealthAt,
    },
    select: {
      id: true,
      ownerType: true,
      organizationId: true,
      doctorProfileId: true,
      displayName: true,
      status: true,
      policyJson: true,
      configJson: true,
      lastHealthAt: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          orgCode: true,
          status: true,
        },
      },
      doctorProfile: {
        select: {
          id: true,
          realName: true,
          hospitalName: true,
        },
      },
      _count: {
        select: {
          knowledgeDocs: true,
        },
      },
    },
  });

  await recordHermesProfileAudit({
    adminId: input.adminId,
    action: "HERMES_PROFILE_CREATED",
    targetId: created.id,
    details: {
      ownerType: created.ownerType,
      displayName: created.displayName,
      status: created.status,
      doctorProfileId: doctor.id,
      knowledgeDefaultMode: configJson.knowledgeDefaultMode,
      doctorBotFallbackEnabled: configJson.doctorBotFallbackEnabled,
    },
  });

  return toHermesProfileView(created);
}

export async function updateAdminHermesProfile(
  id: string,
  input: UpdateAdminHermesProfileInput & { adminId?: string | null }
) {
  const hermesProfileModel = getHermesProfileModel();
  const existing = await hermesProfileModel.findUnique({
    where: { id },
    select: {
      id: true,
      ownerType: true,
      organizationId: true,
      doctorProfileId: true,
      displayName: true,
      status: true,
      policyJson: true,
      configJson: true,
      lastHealthAt: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          orgCode: true,
          status: true,
        },
      },
      doctorProfile: {
        select: {
          id: true,
          realName: true,
          hospitalName: true,
        },
      },
      _count: {
        select: {
          knowledgeDocs: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Hermes Profile 不存在");
  }

  const data: Record<string, unknown> = {};

  if (input.displayName !== undefined) {
    data.displayName = normalizeOptionalText(input.displayName);
  }

  if (input.status) {
    data.status = input.status;
  }

  if (input.policyJson !== undefined) {
    data.policyJson = isPlainObject(input.policyJson) ? input.policyJson : null;
  }

  if (
    input.configJson !== undefined ||
    input.knowledgeDefaultMode !== undefined ||
    input.doctorBotFallbackEnabled !== undefined
  ) {
    data.configJson = buildHermesProfileConfig({
      configJson:
        input.configJson !== undefined
          ? isPlainObject(input.configJson)
            ? input.configJson
            : null
          : (isPlainObject(existing.configJson) ? existing.configJson : null),
      knowledgeDefaultMode: input.knowledgeDefaultMode,
      doctorBotFallbackEnabled: input.doctorBotFallbackEnabled,
    });
  }

  if (input.lastHealthAt !== undefined) {
    data.lastHealthAt = normalizeOptionalDate(input.lastHealthAt);
  }

  const updated = await hermesProfileModel.update({
    where: { id },
    data,
    select: {
      id: true,
      ownerType: true,
      organizationId: true,
      doctorProfileId: true,
      displayName: true,
      status: true,
      policyJson: true,
      configJson: true,
      lastHealthAt: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          orgCode: true,
          status: true,
        },
      },
      doctorProfile: {
        select: {
          id: true,
          realName: true,
          hospitalName: true,
        },
      },
      _count: {
        select: {
          knowledgeDocs: true,
        },
      },
    },
  });

  const runtime = readHermesRuntimeConfig(updated.configJson);
  await recordHermesProfileAudit({
    adminId: input.adminId,
    action: "HERMES_PROFILE_UPDATED",
    targetId: updated.id,
    organizationId: updated.organizationId || null,
    details: {
      ownerType: updated.ownerType,
      displayName: updated.displayName,
      status: updated.status,
      knowledgeDefaultMode: runtime.knowledgeDefaultMode,
      doctorBotFallbackEnabled: runtime.doctorBotFallbackEnabled,
    },
  });

  return toHermesProfileView(updated);
}
