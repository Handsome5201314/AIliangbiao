import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorDashboard } from '@/lib/services/doctor-care';

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const dashboard = await getDoctorDashboard(doctorProfile.id);
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
