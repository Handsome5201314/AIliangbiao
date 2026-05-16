import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import {
  createClinicScreeningPoint,
  listApprovedDoctorsForClinicAssignment,
  listClinicScreeningPoints,
} from '@/lib/services/clinic-screenings';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  ownerDoctorProfileId: z.string().min(1),
  locationLabel: z.string().optional(),
  departmentLabel: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const [points, doctors] = await Promise.all([
      listClinicScreeningPoints(),
      listApprovedDoctorsForClinicAssignment(),
    ]);
    return NextResponse.json({ points, doctors });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load clinic points' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = createSchema.parse(await request.json());
    const point = await createClinicScreeningPoint(body);
    return NextResponse.json({ success: true, point });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error: error instanceof z.ZodError
          ? '请至少填写点位名称并选择所属医生'
          : error instanceof Error
            ? error.message
            : 'Failed to create clinic point',
      },
      { status }
    );
  }
}
