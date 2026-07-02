import { prisma } from "@/lib/db/prisma";

export type AdminOrganizationStatus = "ACTIVE" | "DISABLED";
export type AdminOrganizationStatusFilter = "ALL" | AdminOrganizationStatus;

type ListAdminOrganizationsInput = {
  status?: AdminOrganizationStatusFilter;
  query?: string;
};

type SaveAdminOrganizationInput = {
  name: string;
  orgCode?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  status?: AdminOrganizationStatus;
};

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getOrganizationModel() {
  const organizationModel = (prisma as any).organization;
  if (!organizationModel?.findMany) {
    throw new Error("Organization model is not available");
  }

  return organizationModel;
}

function toOrganizationView(record: any) {
  return {
    id: record.id,
    name: record.name,
    orgCode: record.orgCode || null,
    status: record.status,
    contactName: record.contactName || null,
    contactPhone: record.contactPhone || null,
    createdByAdminId: record.createdByAdminId || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    doctorCount: record._count?.doctors || 0,
  };
}

export async function listAdminOrganizations(input: ListAdminOrganizationsInput = {}) {
  const organizationModel = getOrganizationModel();
  const query = input.query?.trim();

  const where = {
    ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { orgCode: { contains: query, mode: "insensitive" } },
            { contactName: { contains: query, mode: "insensitive" } },
            { contactPhone: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const organizations = await organizationModel.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      orgCode: true,
      status: true,
      contactName: true,
      contactPhone: true,
      createdByAdminId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          doctors: true,
        },
      },
    },
  });

  return organizations.map(toOrganizationView);
}

export async function createAdminOrganization(
  input: SaveAdminOrganizationInput & { createdByAdminId?: string | null }
) {
  const organizationModel = getOrganizationModel();
  const created = await organizationModel.create({
    data: {
      name: input.name.trim(),
      orgCode: normalizeOptionalText(input.orgCode),
      contactName: normalizeOptionalText(input.contactName),
      contactPhone: normalizeOptionalText(input.contactPhone),
      createdByAdminId: input.createdByAdminId || null,
      status: input.status || "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      orgCode: true,
      status: true,
      contactName: true,
      contactPhone: true,
      createdByAdminId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          doctors: true,
        },
      },
    },
  });

  return toOrganizationView(created);
}

export async function updateAdminOrganization(
  id: string,
  input: Partial<SaveAdminOrganizationInput>
) {
  const organizationModel = getOrganizationModel();

  const data: Record<string, unknown> = {};
  if (typeof input.name === "string") {
    data.name = input.name.trim();
  }
  if (input.orgCode !== undefined) {
    data.orgCode = normalizeOptionalText(input.orgCode);
  }
  if (input.contactName !== undefined) {
    data.contactName = normalizeOptionalText(input.contactName);
  }
  if (input.contactPhone !== undefined) {
    data.contactPhone = normalizeOptionalText(input.contactPhone);
  }
  if (input.status) {
    data.status = input.status;
  }

  const updated = await organizationModel.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      orgCode: true,
      status: true,
      contactName: true,
      contactPhone: true,
      createdByAdminId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          doctors: true,
        },
      },
    },
  });

  return toOrganizationView(updated);
}
