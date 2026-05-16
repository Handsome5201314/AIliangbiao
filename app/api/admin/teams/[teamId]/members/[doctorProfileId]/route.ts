import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { adminRemoveDoctorFromCareTeam } from '@/lib/services/care-teams';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; doctorProfileId: string }> },
) {
  try {
    await requireAdminRequest(request);
    const { teamId, doctorProfileId } = await context.params;
    await adminRemoveDoctorFromCareTeam({
      teamId,
      targetDoctorProfileId: doctorProfileId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove team member' },
      { status: 500 },
    );
  }
}
