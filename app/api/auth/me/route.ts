import { NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/auth/user-session';

export async function GET(request: NextRequest) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) {
    return NextResponse.json({ user: null });
  }

  const { user } = authenticated;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      accountType: user.accountType,
      role: user.role,
      isGuest: user.isGuest,
      doctorProfile: user.doctorProfile,
    },
  });
}
