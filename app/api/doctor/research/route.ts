import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { requireDoctorUser } from '@/lib/auth/user-session';

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireDoctorUser(request, { requireApproved: true });
    const logs = await prisma.researchExportLog.findMany({
      where: {
        doctorProfileId: user.doctorProfile!.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
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
      { error: error instanceof Error ? error.message : 'Failed to load research exports' },
      { status: 401 }
    );
  }
}
