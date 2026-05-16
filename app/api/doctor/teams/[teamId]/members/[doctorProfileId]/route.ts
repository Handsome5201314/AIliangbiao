import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  removeDoctorFromCareTeam,
  updateCareTeamMemberRole,
} from '@/lib/services/care-teams';

const updateRoleSchema = z.object({
  teamRole: z.enum(['LEAD', 'MEMBER']),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; doctorProfileId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { teamId, doctorProfileId } = await context.params;
    const body = updateRoleSchema.parse(await request.json());
    const member = await updateCareTeamMemberRole({
      actorDoctorProfileId: doctorProfile.id,
      teamId,
      targetDoctorProfileId: doctorProfileId,
      teamRole: body.teamRole,
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update team member role' },
      { status },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; doctorProfileId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { teamId, doctorProfileId } = await context.params;
    await removeDoctorFromCareTeam({
      actorDoctorProfileId: doctorProfile.id,
      teamId,
      targetDoctorProfileId: doctorProfileId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove team member' },
      { status: 401 },
    );
  }
}
