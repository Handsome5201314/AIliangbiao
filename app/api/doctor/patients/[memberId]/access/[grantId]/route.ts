import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  revokeMemberAccessGrant,
  updateMemberAccessGrant,
} from '@/lib/services/care-teams';

const updateGrantSchema = z.object({
  accessRole: z.enum(['COLLABORATOR', 'READONLY']),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ memberId: string; grantId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { grantId } = await context.params;
    const body = updateGrantSchema.parse(await request.json());
    const grant = await updateMemberAccessGrant({
      ownerDoctorProfileId: doctorProfile.id,
      grantId,
      accessRole: body.accessRole,
    });

    return NextResponse.json({ success: true, grant });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update member access grant' },
      { status },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ memberId: string; grantId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { grantId } = await context.params;
    const grant = await revokeMemberAccessGrant({
      ownerDoctorProfileId: doctorProfile.id,
      grantId,
    });

    return NextResponse.json({ success: true, grant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke member access grant' },
      { status: 401 },
    );
  }
}
