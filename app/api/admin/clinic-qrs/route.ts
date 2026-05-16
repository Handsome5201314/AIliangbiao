import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { createClinicScaleQr, listClinicScaleQrs } from '@/lib/services/clinic-screenings';

const createSchema = z.object({
  pointId: z.string().min(1),
  scaleId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const qrs = await listClinicScaleQrs();
    return NextResponse.json({ qrs });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load clinic QRs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = createSchema.parse(await request.json());
    const qr = await createClinicScaleQr(body);
    return NextResponse.json({ success: true, qr });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create clinic QR' },
      { status }
    );
  }
}
