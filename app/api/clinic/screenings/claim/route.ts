import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { claimClinicScreening } from '@/lib/services/clinic-screenings';

const requestSchema = z.object({
  screeningCode: z.string().min(1),
  memberId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requirePatientUser(request);
    const body = requestSchema.parse(await request.json());

    const result = await claimClinicScreening({
      userId: user.id,
      screeningCode: body.screeningCode,
      memberId: body.memberId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to claim clinic screening' },
      { status }
    );
  }
}
