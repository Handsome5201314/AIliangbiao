import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireDoctorUser } from '@/lib/auth/user-session';
import { addDoctorPatientNote } from '@/lib/domain/care-service';

const requestSchema = z.object({
  content: z.string().min(1),
  noteType: z.enum(['CLINICAL', 'RESEARCH']).optional(),
  assessmentHistoryId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requireDoctorUser(request, { requireApproved: true });
    const body = requestSchema.parse(await request.json());
    const { memberId } = await context.params;

    const note = await addDoctorPatientNote({
      doctorProfileId: user.doctorProfile!.id,
      memberId,
      content: body.content,
      noteType: body.noteType,
      assessmentHistoryId: body.assessmentHistoryId,
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add doctor note' },
      { status }
    );
  }
}
