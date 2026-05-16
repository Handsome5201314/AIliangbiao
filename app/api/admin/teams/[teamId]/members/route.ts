import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import {
  adminAddDoctorToCareTeam,
  listCareTeamMembers,
} from '@/lib/services/care-teams';

const createMemberSchema = z.object({
  doctorProfileId: z.string().min(1),
  teamRole: z.enum(['LEAD', 'MEMBER']).default('MEMBER'),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    await requireAdminRequest(request);
    const { teamId } = await context.params;
    const members = await listCareTeamMembers(teamId);
    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load team members' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    await requireAdminRequest(request);
    const { teamId } = await context.params;
    const body = createMemberSchema.parse(await request.json());
    const member = await adminAddDoctorToCareTeam({
      teamId,
      targetDoctorProfileId: body.doctorProfileId,
      teamRole: body.teamRole,
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add team member' },
      { status },
    );
  }
}
