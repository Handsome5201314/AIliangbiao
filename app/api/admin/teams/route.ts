import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { createCareTeam, listCareTeamsForAdmin } from '@/lib/services/care-teams';

const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  hospitalName: z.string().trim().min(2).max(120),
  departmentName: z.string().trim().min(2).max(120),
  leadDoctorProfileId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const teams = await listCareTeamsForAdmin();
    return NextResponse.json({ teams });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load teams' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request);
    const body = createTeamSchema.parse(await request.json());
    const team = await createCareTeam({
      adminId: admin.id,
      ...body,
    });

    return NextResponse.json({ success: true, team });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create team' },
      { status },
    );
  }
}
