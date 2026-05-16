import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { issueAppSessionToken } from '@/lib/auth/app-session';
import { createDoctorAccount } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  realName: z.string().min(2),
  hospitalName: z.string().min(2),
  departmentName: z.string().min(2),
  title: z.string().min(2),
  licenseNo: z.string().min(4),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await createDoctorAccount({
      email: body.email,
      phone: body.phone,
      passwordHash,
      realName: body.realName,
      hospitalName: body.hospitalName,
      departmentName: body.departmentName,
      title: body.title,
      licenseNo: body.licenseNo,
    });

    const session = issueAppSessionToken({
      userId: user.id,
      accountType: 'DOCTOR',
      role: user.role,
      email: user.email || undefined,
      doctorProfileId: user.doctorProfile?.id,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        role: user.role,
        doctorProfile: user.doctorProfile,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register doctor' },
      { status }
    );
  }
}
