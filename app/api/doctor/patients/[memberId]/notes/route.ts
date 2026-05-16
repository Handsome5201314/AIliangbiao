import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { createDoctorPatientNote } from '@/lib/services/doctor-care';

const requestSchema = z.object({
  assessmentHistoryId: z.string().optional(),
  noteType: z.enum(['CLINICAL', 'RESEARCH']).default('CLINICAL'),
  content: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const body = requestSchema.parse(await request.json());

    const note = await createDoctorPatientNote({
      doctorProfileId: doctorProfile.id,
      memberId,
      assessmentHistoryId: body.assessmentHistoryId,
      noteType: body.noteType,
      content: body.content,
    });

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create note' },
      { status }
    );
  }
}
