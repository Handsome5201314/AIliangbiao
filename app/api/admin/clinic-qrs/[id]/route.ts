import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { updateClinicScaleQr } from '@/lib/services/clinic-screenings';

const updateSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRequest(request);
    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());
    const qr = await updateClinicScaleQr({
      id,
      isActive: body.isActive,
    });
    return NextResponse.json({ success: true, qr });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update clinic QR' },
      { status }
    );
  }
}
