import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

import { getAdminSessionTokenFromRequest, verifyAdminSessionToken } from './admin-session';
import { canAccessAdminRoles, normalizeAdminRole, type AdminRole } from './admin-role';

type RequireAdminRequestOptions = {
  roles?: readonly AdminRole[];
};

export async function requireAdminRequest(
  request: NextRequest,
  options: RequireAdminRequestOptions = {}
) {
  const token = getAdminSessionTokenFromRequest(request);
  if (!token) {
    throw new Error('Unauthorized');
  }

  let session;
  try {
    session = verifyAdminSessionToken(token);
  } catch {
    throw new Error('Unauthorized');
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
  });

  if (!admin) {
    throw new Error('Unauthorized');
  }

  const normalizedRole = normalizeAdminRole(admin.role);
  if (!normalizedRole) {
    throw new Error('Unauthorized');
  }

  if (!canAccessAdminRoles(normalizedRole, options.roles)) {
    throw new Error('Unauthorized');
  }

  return {
    session,
    admin: {
      ...admin,
      role: normalizedRole,
      rawRole: admin.role,
    },
  };
}

export function createAdminUnauthorizedResponse(message = '管理员登录已失效，请重新登录') {
  return NextResponse.json({ error: message }, { status: 401 });
}
