import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { listDoctors } from '@/lib/services/doctor-care';

const ALLOWED_STATUSES = new Set(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']);

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const rawStatus = request.nextUrl.searchParams.get('status')?.toUpperCase() || 'ALL';
    const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : 'ALL';
    const doctors = await listDoctors(status as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED');

    return NextResponse.json({ doctors, status });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load doctors' },
      { status: 500 }
    );
  }
}
