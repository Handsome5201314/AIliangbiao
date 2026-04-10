import { NextRequest, NextResponse } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/auth/require-app-session';

export async function GET(request: NextRequest) {
  try {
    const { session, user } = await requireAuthenticatedUser(request);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountType: user.accountType,
        doctorProfile: user.doctorProfile
          ? {
              id: user.doctorProfile.id,
              verificationStatus: user.doctorProfile.verificationStatus,
              realName: user.doctorProfile.realName,
              hospitalName: user.doctorProfile.hospitalName,
              departmentName: user.doctorProfile.departmentName,
              title: user.doctorProfile.title,
            }
          : null,
        session,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
