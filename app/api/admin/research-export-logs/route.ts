import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { requireAdminToken } from '@/lib/auth/admin-token';

export async function GET(request: NextRequest) {
  try {
    await requireAdminToken(request);
    const logs = await prisma.researchExportLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        doctorProfile: {
          select: {
            realName: true,
            hospitalName: true,
          },
        },
        memberProfile: {
          select: {
            relation: true,
            ageMonths: true,
            gender: true,
          },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load research export logs' },
      { status: 401 }
    );
  }
}
