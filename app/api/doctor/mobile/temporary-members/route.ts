import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { createMobileTemporaryMember } from '@/lib/services/mobile-doctor';

const requestSchema = z.object({
  name: z.string().trim().min(1),
  gender: z.enum(['male', 'female']),
  ageMonths: z.number().int().min(0).max(216),
  contact: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  return 401;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const body = requestSchema.parse(await request.json());
    const patient = await createMobileTemporaryMember({
      doctorProfileId: doctorProfile.id,
      ...body,
    });

    return NextResponse.json({ patient });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create temporary patient' },
      { status: errorStatus(error) }
    );
  }
}
