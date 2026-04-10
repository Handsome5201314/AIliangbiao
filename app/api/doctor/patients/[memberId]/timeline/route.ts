import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorPatientTimeline } from '@/lib/services/doctor-care';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const events = await getDoctorPatientTimeline(doctorProfile.id, memberId);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
