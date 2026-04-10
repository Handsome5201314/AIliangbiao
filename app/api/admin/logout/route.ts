import { NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieOptions } from '@/lib/auth/admin-session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
