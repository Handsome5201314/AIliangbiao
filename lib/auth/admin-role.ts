export const ADMIN_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  KB_REVIEWER: "KB_REVIEWER",
  ORG_REVIEWER: "ORG_REVIEWER",
  AUDITOR: "AUDITOR",
  OPS: "OPS",
} as const;

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

const ROLE_ALIAS_MAP: Record<string, AdminRole> = {
  SUPER_ADMIN: ADMIN_ROLE.SUPER_ADMIN,
  SUPERADMIN: ADMIN_ROLE.SUPER_ADMIN,
  ADMIN: ADMIN_ROLE.SUPER_ADMIN,
  KB_REVIEWER: ADMIN_ROLE.KB_REVIEWER,
  KBREVIEWER: ADMIN_ROLE.KB_REVIEWER,
  ORG_REVIEWER: ADMIN_ROLE.ORG_REVIEWER,
  ORGREVIEWER: ADMIN_ROLE.ORG_REVIEWER,
  AUDITOR: ADMIN_ROLE.AUDITOR,
  OPS: ADMIN_ROLE.OPS,
};

function normalizeRoleKey(role: string) {
  return role.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function normalizeAdminRole(role?: string | null): AdminRole | null {
  if (!role) {
    return null;
  }

  return ROLE_ALIAS_MAP[normalizeRoleKey(role)] || null;
}

export function canAccessAdminRoles(
  role: string | AdminRole | null | undefined,
  allowedRoles?: readonly AdminRole[]
) {
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) {
    return false;
  }

  if (!allowedRoles?.length) {
    return true;
  }

  return allowedRoles.includes(normalizedRole);
}

export function getAdminRoleLabel(role?: string | null) {
  switch (normalizeAdminRole(role)) {
    case ADMIN_ROLE.SUPER_ADMIN:
      return "超级管理员";
    case ADMIN_ROLE.KB_REVIEWER:
      return "知识审核";
    case ADMIN_ROLE.ORG_REVIEWER:
      return "机构审核";
    case ADMIN_ROLE.AUDITOR:
      return "审计员";
    case ADMIN_ROLE.OPS:
      return "运维";
    default:
      return "未分配角色";
  }
}
