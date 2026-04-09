import { NextRequest, NextResponse } from 'next/server';

import { requireDoctorUser } from '@/lib/auth/user-session';
import { getDoctorDashboard } from '@/lib/domain/care-service';

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireDoctorUser(request, { requireApproved: true });
    const dashboard = await getDoctorDashboard(user.doctorProfile!.id);
    return NextResponse.json({ dashboard });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load doctor dashboard' },
      { status: 401 }
    );
  }
}
