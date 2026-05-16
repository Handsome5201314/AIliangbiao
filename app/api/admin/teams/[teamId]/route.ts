import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { updateCareTeam } from '@/lib/services/care-teams';

const updateTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    hospitalName: z.string().trim().min(2).max(120).optional(),
    departmentName: z.string().trim().min(2).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.hospitalName !== undefined ||
      value.departmentName !== undefined ||
      value.isActive !== undefined,
    { message: 'At least one field is required' },
  );

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    await requireAdminRequest(request);
    const { teamId } = await context.params;
    const body = updateTeamSchema.parse(await request.json());
    const team = await updateCareTeam({
      teamId,
      ...body,
    });

    return NextResponse.json({ success: true, team });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update team' },
      { status },
    );
  }
}
