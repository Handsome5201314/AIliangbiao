import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  getDoctorNeonateArchiveDetail,
  updateDoctorNeonateArchive,
} from '@/lib/services/doctor-neonates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateArchiveSchema = z
  .object({
    babyName: z.string().trim().min(1).max(50).optional(),
    sex: z.enum(['boy', 'girl']).optional(),
    birthGestationWeeks: z.number().int().min(20).max(45).optional(),
    birthGestationDays: z.number().int().min(0).max(6).optional(),
    birthDate: z.string().date().optional(),
    birthTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  })
  .refine(
    (value) =>
      value.babyName !== undefined ||
      value.sex !== undefined ||
      value.birthGestationWeeks !== undefined ||
      value.birthGestationDays !== undefined ||
      value.birthDate !== undefined ||
      value.birthTime !== undefined,
    {
      message: 'At least one field is required',
    },
  );

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ archiveId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { archiveId } = await context.params;
    const archive = await getDoctorNeonateArchiveDetail(doctorProfile.id, archiveId);

    return NextResponse.json({ archive });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ archiveId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { archiveId } = await context.params;
    const body = updateArchiveSchema.parse(await request.json());
    const archive = await updateDoctorNeonateArchive({
      doctorProfileId: doctorProfile.id,
      archiveId,
      ...body,
    });

    return NextResponse.json({ archive });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update neonate archive' },
      { status },
    );
  }
}
