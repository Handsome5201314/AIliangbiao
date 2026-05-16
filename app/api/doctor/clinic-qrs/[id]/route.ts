import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { updateDoctorOwnedClinicScaleQr } from '@/lib/services/clinic-screenings';

const updateSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());
    const qr = await updateDoctorOwnedClinicScaleQr({
      doctorProfileId: doctorProfile.id,
      id,
      isActive: body.isActive,
    });
    return NextResponse.json({ success: true, qr });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update clinic QR' },
      { status }
    );
  }
}
