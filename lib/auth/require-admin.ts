import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

import { getAdminSessionTokenFromRequest, verifyAdminSessionToken } from './admin-session';

export async function requireAdminRequest(request: NextRequest) {
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

  return {
    session,
    admin,
  };
}

export function createAdminUnauthorizedResponse(message = '管理员登录已失效，请重新登录') {
  return NextResponse.json({ error: message }, { status: 401 });
}
