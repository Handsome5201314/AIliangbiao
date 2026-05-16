import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorAssessmentReport } from '@/lib/services/doctor-care';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string; assessmentId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId, assessmentId } = await context.params;

    const report = await getDoctorAssessmentReport({
      doctorProfileId: doctorProfile.id,
      memberId,
      assessmentId,
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load assessment report' },
      { status: 401 }
    );
  }
}
