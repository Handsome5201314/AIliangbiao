import { NextRequest, NextResponse } from 'next/server';

import { requireDoctorUser } from '@/lib/auth/user-session';
import { getDoctorPatientTimeline } from '@/lib/domain/care-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requireDoctorUser(request, { requireApproved: true });
    const { memberId } = await context.params;
    const timeline = await getDoctorPatientTimeline(user.doctorProfile!.id, memberId);
    return NextResponse.json({ timeline });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load patient timeline' },
      { status: 401 }
    );
  }
}
