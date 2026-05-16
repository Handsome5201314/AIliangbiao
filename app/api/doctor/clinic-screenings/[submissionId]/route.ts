import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorClinicScreeningDetail } from '@/lib/services/clinic-screenings';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { submissionId } = await context.params;
    const screening = await getDoctorClinicScreeningDetail({
      doctorProfileId: doctorProfile.id,
      submissionId,
    });
    return NextResponse.json({ screening });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
