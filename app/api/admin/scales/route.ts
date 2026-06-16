import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { getAdminScaleById, listAdminScales } from '@/lib/scales/catalog';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN],
    });

    const scaleId = request.nextUrl.searchParams.get('id');
    if (scaleId) {
      const scale = getAdminScaleById(scaleId);

      if (!scale) {
        return NextResponse.json({ error: 'Scale not found' }, { status: 404 });
      }

      return NextResponse.json({ scale });
    }

    return NextResponse.json({
      scales: listAdminScales(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json({ error: '获取量表列表失败' }, { status: 500 });
  }
}
