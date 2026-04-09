import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { requireAdminToken } from '@/lib/auth/admin-token';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ doctorId: string }> }
) {
  try {
    const admin = await requireAdminToken(request);
    const { doctorId } = await context.params;
    const profile = await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        verificationStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedByAdminId: admin.id,
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve doctor' },
      { status: 401 }
    );
  }
}
