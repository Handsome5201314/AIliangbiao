import { NextRequest, NextResponse } from 'next/server';

import { clearUserSessionCookie } from '@/lib/auth/user-session';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true });
  clearUserSessionCookie(response);
  return response;
}
