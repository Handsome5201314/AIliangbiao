import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  createNeonateAccessGrant,
  listNeonateAccessOverview,
} from '@/lib/services/care-teams';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createGrantSchema = z.object({
  targetDoctorProfileId: z.string().min(1),
  sourceTeamId: z.string().min(1),
  accessRole: z.enum(['COLLABORATOR', 'READONLY']),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ archiveId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { archiveId } = await context.params;
    const result = await listNeonateAccessOverview(archiveId, doctorProfile.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ archiveId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { archiveId } = await context.params;
    const body = createGrantSchema.parse(await request.json());
    const grant = await createNeonateAccessGrant({
      ownerDoctorProfileId: doctorProfile.id,
      archiveId,
      targetDoctorProfileId: body.targetDoctorProfileId,
      sourceTeamId: body.sourceTeamId,
      accessRole: body.accessRole,
    });

    return NextResponse.json({ success: true, grant });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create neonate access grant' },
      { status },
    );
  }
}
