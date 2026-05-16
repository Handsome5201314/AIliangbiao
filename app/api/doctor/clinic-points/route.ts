import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  createDoctorOwnedClinicScreeningPoint,
  listDoctorOwnedClinicScreeningPoints,
} from '@/lib/services/clinic-screenings';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  locationLabel: z.string().optional(),
  departmentLabel: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const points = await listDoctorOwnedClinicScreeningPoints(doctorProfile.id);
    return NextResponse.json({ points });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const body = createSchema.parse(await request.json());
    const point = await createDoctorOwnedClinicScreeningPoint({
      doctorProfileId: doctorProfile.id,
      defaultDepartmentLabel: doctorProfile.departmentName,
      ...body,
    });
    return NextResponse.json({ success: true, point });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      {
        error: error instanceof z.ZodError
          ? '请至少填写门诊点位名称'
          : error instanceof Error
            ? error.message
            : 'Failed to create clinic point',
      },
      { status }
    );
  }
}
