import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { getAdminDashboard } from '@/lib/services/admin-dashboard';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const dashboard = await getAdminDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load admin dashboard' },
      { status: 500 }
    );
  }
}
