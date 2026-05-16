import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { updateDoctorVerification } from '@/lib/services/doctor-care';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { admin } = await requireAdminRequest(request);
    const { doctorId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const doctor = await updateDoctorVerification({
      doctorProfileId: doctorId,
      status: 'REJECTED',
      adminId: admin.id,
      reviewNotes: body.reviewNotes,
    });

    return NextResponse.json({ success: true, doctor });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject doctor' },
      { status: 500 }
    );
  }
}
