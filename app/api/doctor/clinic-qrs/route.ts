import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  createDoctorOwnedClinicScaleQr,
  listDoctorOwnedClinicScaleQrs,
} from '@/lib/services/clinic-screenings';

const createSchema = z.object({
  pointId: z.string().min(1),
  scaleId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const qrs = await listDoctorOwnedClinicScaleQrs(doctorProfile.id);
    return NextResponse.json({ qrs });
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
    const qr = await createDoctorOwnedClinicScaleQr({
      doctorProfileId: doctorProfile.id,
      ...body,
    });
    return NextResponse.json({ success: true, qr });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      {
        error: error instanceof z.ZodError
          ? '请先选择门诊点位和量表'
          : error instanceof Error
            ? error.message
            : 'Failed to create clinic QR',
      },
      { status }
    );
  }
}
