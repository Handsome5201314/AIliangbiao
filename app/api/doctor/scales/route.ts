import { NextRequest, NextResponse } from 'next/server';

import { requireDoctorUser } from '@/lib/auth/require-app-session';
import {
  getDoctorVisibleScaleById,
  listDoctorVisibleScales,
} from '@/lib/scales/catalog';

export async function GET(request: NextRequest) {
  try {
    await requireDoctorUser(request);

    const scaleId = request.nextUrl.searchParams.get('id');

    if (scaleId) {
      const scale = getDoctorVisibleScaleById(scaleId);

      if (!scale) {
        return NextResponse.json({ error: 'Scale not found' }, { status: 404 });
      }

      return NextResponse.json({ scale });
    }

    return NextResponse.json({
      scales: listDoctorVisibleScales(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
