import { prisma } from "@/lib/db/prisma";

export type AdminAuditActorType = "ALL" | "USER" | "DOCTOR" | "ADMIN" | "SYSTEM";
export type AdminAuditTargetType =
  | "ALL"
  | "MEMBER_PROFILE"
  | "KNOWLEDGE_DOC"
  | "QUESTION_EXPLANATION"
  | "AGENT_SESSION";

type ListAdminAuditLogsInput = {
  actorType?: AdminAuditActorType;
  targetType?: AdminAuditTargetType;
  query?: string;
  limit?: number;
};

function summarizeAuditDetails(details: unknown) {
  if (!details) {
    return null;
  }

  if (typeof details === "string") {
    return details.length > 160 ? `${details.slice(0, 157)}...` : details;
  }

  try {
    const serialized = JSON.stringify(details);
    return serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
  } catch {
    return null;
  }
}

function toUniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function listAdminAuditLogs(input: ListAdminAuditLogsInput = {}) {
  const auditLogModel = (prisma as any).auditLog;
  if (!auditLogModel?.findMany) {
    throw new Error("AuditLog model is not available");
  }

  const query = input.query?.trim();
  const logs = await auditLogModel.findMany({
    where: {
      ...(input.actorType && input.actorType !== "ALL" ? { actorType: input.actorType } : {}),
      ...(input.targetType && input.targetType !== "ALL" ? { targetType: input.targetType } : {}),
      ...(query
        ? {
            OR: [
              { action: { contains: query, mode: "insensitive" } },
              { targetId: { contains: query, mode: "insensitive" } },
              { memberProfileId: { contains: query, mode: "insensitive" } },
              { organizationId: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit || 100,
  });

  const adminIds = toUniqueIds(logs.map((log: any) => log.actorAdminId));
  const doctorIds = toUniqueIds(logs.map((log: any) => log.actorDoctorProfileId));
  const userIds = toUniqueIds(logs.map((log: any) => log.actorUserId));

  const adminMap = new Map<string, string>();
  const doctorMap = new Map<string, string>();
  const userMap = new Map<string, string>();

  if (adminIds.length) {
    const admins = await prisma.admin.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, username: true, email: true },
    });
    admins.forEach((admin) => {
      adminMap.set(admin.id, admin.username || admin.email || admin.id);
    });
  }

  if (doctorIds.length) {
    const doctors = await prisma.doctorProfile.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, realName: true, hospitalName: true },
    });
    doctors.forEach((doctor) => {
      doctorMap.set(doctor.id, doctor.realName || doctor.hospitalName || doctor.id);
    });
  }

  if (userIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, phone: true },
    });
    users.forEach((user) => {
      userMap.set(user.id, user.email || user.phone || user.id);
    });
  }

  return logs.map((log: any) => {
    const actorLabel =
      log.actorType === "ADMIN"
        ? adminMap.get(log.actorAdminId) || log.actorAdminId || "管理员"
        : log.actorType === "DOCTOR"
          ? doctorMap.get(log.actorDoctorProfileId) || log.actorDoctorProfileId || "医生"
          : log.actorType === "USER"
            ? userMap.get(log.actorUserId) || log.actorUserId || "用户"
            : "系统";

    return {
      id: log.id,
      organizationId: log.organizationId || null,
      actorType: log.actorType,
      actorLabel,
      actorUserId: log.actorUserId || null,
      actorDoctorProfileId: log.actorDoctorProfileId || null,
      actorAdminId: log.actorAdminId || null,
      memberProfileId: log.memberProfileId || null,
      targetType: log.targetType,
      targetId: log.targetId || null,
      action: log.action,
      details: log.details || null,
      detailsSummary: summarizeAuditDetails(log.details),
      createdAt: log.createdAt,
    };
  });
}
