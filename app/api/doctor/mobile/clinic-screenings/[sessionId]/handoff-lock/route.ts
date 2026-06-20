import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { lockMobileClinicAssessmentSession } from '@/lib/services/mobile-doctor';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { sessionId } = await context.params;
    const result = await lockMobileClinicAssessmentSession({
      doctorProfileId: doctorProfile.id,
      sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to lock mobile handoff session' },
      { status: 401 }
    );
  }
}
