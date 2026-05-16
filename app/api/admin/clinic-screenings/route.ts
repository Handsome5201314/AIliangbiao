import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { listAdminClinicScreenings } from '@/lib/services/clinic-screenings';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const screenings = await listAdminClinicScreenings({
      pointId: request.nextUrl.searchParams.get('pointId') || undefined,
      scaleId: request.nextUrl.searchParams.get('scaleId') || undefined,
      screeningCode: request.nextUrl.searchParams.get('screeningCode') || undefined,
      respondentName: request.nextUrl.searchParams.get('respondentName') || undefined,
      status: request.nextUrl.searchParams.get('status') || undefined,
    });
    return NextResponse.json({ screenings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load clinic screenings' },
      { status: 500 }
    );
  }
}
