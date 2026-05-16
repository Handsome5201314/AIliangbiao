import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { adminDeleteDoctor } from '@/lib/services/doctor-care';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ doctorId: string }> }
) {
  try {
    await requireAdminRequest(request);
    const { doctorId } = await context.params;
    await adminDeleteDoctor(doctorId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete doctor' },
      { status: 500 }
    );
  }
}
