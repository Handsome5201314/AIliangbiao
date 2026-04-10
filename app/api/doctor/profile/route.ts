import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireDoctorUser } from '@/lib/auth/require-app-session';
import { updateDoctorProfile } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  realName: z.string().min(2).optional(),
  hospitalName: z.string().min(2).optional(),
  departmentName: z.string().min(2).optional(),
  title: z.string().min(2).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireDoctorUser(request);
    return NextResponse.json({ doctorProfile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { doctorProfile } = await requireDoctorUser(request);
    const body = requestSchema.parse(await request.json());
    const updated = await updateDoctorProfile({
      doctorProfileId: doctorProfile.id,
      ...body,
    });
    return NextResponse.json({ success: true, doctorProfile: updated });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update doctor profile' },
      { status }
    );
  }
}
