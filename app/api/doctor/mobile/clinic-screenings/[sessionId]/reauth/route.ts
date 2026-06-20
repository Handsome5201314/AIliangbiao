import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { verifyMobileDoctorReauth } from '@/lib/services/mobile-doctor';

const requestSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
});

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  return 401;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user, doctorProfile } = await requireApprovedDoctorUser(request);
    const { sessionId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await verifyMobileDoctorReauth({
      doctorUserId: user.id,
      doctorProfileId: doctorProfile.id,
      sessionId,
      pin: body.pin,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Doctor reauthentication failed' },
      { status: errorStatus(error) }
    );
  }
}
