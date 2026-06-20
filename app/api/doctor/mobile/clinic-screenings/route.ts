import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { createMobileClinicAssessmentSession } from '@/lib/services/mobile-doctor';

const requestSchema = z.object({
  patientId: z.string().min(1),
  scaleId: z.string().min(1),
  fillMode: z.enum(['doctor_assisted', 'caregiver_handoff_locked']),
});

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  return 401;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const body = requestSchema.parse(await request.json());
    const session = await createMobileClinicAssessmentSession({
      doctorProfileId: doctorProfile.id,
      memberId: body.patientId,
      scaleId: body.scaleId,
      fillMode: body.fillMode,
    });

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create mobile clinic session' },
      { status: errorStatus(error) }
    );
  }
}
