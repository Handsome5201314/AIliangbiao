import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { requireAdminToken } from '@/lib/auth/admin-token';

export async function GET(request: NextRequest) {
  try {
    await requireAdminToken(request);
    const doctors = await prisma.doctorProfile.findMany({
      where: {
        verificationStatus: 'PENDING',
      },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ doctors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pending doctors' },
      { status: 401 }
    );
  }
}
