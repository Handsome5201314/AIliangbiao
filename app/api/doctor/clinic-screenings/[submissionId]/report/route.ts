import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorClinicScreeningReport } from '@/lib/services/clinic-screenings';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { submissionId } = await context.params;
    const report = await getDoctorClinicScreeningReport({
      doctorProfileId: doctorProfile.id,
      submissionId,
    });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load clinic screening report' },
      { status: 401 }
    );
  }
}
