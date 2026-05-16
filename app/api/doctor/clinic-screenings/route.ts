import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { listDoctorClinicScreenings } from '@/lib/services/clinic-screenings';

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const screenings = await listDoctorClinicScreenings({
      doctorProfileId: doctorProfile.id,
      pointId: request.nextUrl.searchParams.get('pointId') || undefined,
      scaleId: request.nextUrl.searchParams.get('scaleId') || undefined,
      screeningCode: request.nextUrl.searchParams.get('screeningCode') || undefined,
      respondentName: request.nextUrl.searchParams.get('respondentName') || undefined,
      status: request.nextUrl.searchParams.get('status') || undefined,
    });
    return NextResponse.json({ screenings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
