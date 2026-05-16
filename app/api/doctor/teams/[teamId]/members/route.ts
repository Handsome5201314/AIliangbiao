import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  addDoctorToCareTeam,
  listDoctorTeamMembers,
} from '@/lib/services/care-teams';

const addMemberSchema = z.object({
  doctorProfileId: z.string().min(1),
  teamRole: z.enum(['LEAD', 'MEMBER']).default('MEMBER'),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { teamId } = await context.params;
    const result = await listDoctorTeamMembers(teamId, doctorProfile.id);
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
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { teamId } = await context.params;
    const body = addMemberSchema.parse(await request.json());
    const member = await addDoctorToCareTeam({
      actorDoctorProfileId: doctorProfile.id,
      teamId,
      targetDoctorProfileId: body.doctorProfileId,
      teamRole: body.teamRole,
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add team member' },
      { status },
    );
  }
}
