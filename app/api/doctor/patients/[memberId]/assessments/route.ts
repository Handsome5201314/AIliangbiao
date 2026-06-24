import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { createDoctorPatientAssessmentSession } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  scaleId: z.string().min(1),
  mode: z.enum(['doctor_assisted', 'caregiver_handoff']).optional(),
});

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  return 401;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const session = await createDoctorPatientAssessmentSession({
      doctorProfileId: doctorProfile.id,
      memberId,
      scaleId: body.scaleId,
      mode: body.mode,
    });

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create assessment session' },
      { status: errorStatus(error) }
    );
  }
}
