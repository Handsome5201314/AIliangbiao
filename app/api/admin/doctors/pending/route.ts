import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { listPendingDoctors } from '@/lib/services/doctor-care';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const doctors = await listPendingDoctors();
    return NextResponse.json({ doctors });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pending doctors' },
      { status: 500 }
    );
  }
}
