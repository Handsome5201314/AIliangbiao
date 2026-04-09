import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { requireDoctorUser } from '@/lib/auth/user-session';

const requestSchema = z.object({
  realName: z.string().min(1).optional(),
  hospitalName: z.string().min(1).optional(),
  departmentName: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  licenseNo: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireDoctorUser(request);
    return NextResponse.json({
      profile: user.doctorProfile,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load doctor profile' },
      { status: 401 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireDoctorUser(request);
    const body = requestSchema.parse(await request.json());

    const profile = await prisma.doctorProfile.update({
      where: { id: user.doctorProfile!.id },
      data: body,
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update doctor profile' },
      { status }
    );
  }
}
