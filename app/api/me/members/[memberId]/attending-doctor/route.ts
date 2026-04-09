import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePatientUser } from '@/lib/auth/user-session';
import {
  assignAttendingDoctor,
  getAttendingDoctorForMember,
  revokeAttendingDoctor,
} from '@/lib/domain/care-service';

const requestSchema = z.object({
  doctorProfileId: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;
    const assignment = await getAttendingDoctorForMember(user.id, memberId);
    return NextResponse.json({ assignment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get attending doctor' },
      { status: 401 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const body = requestSchema.parse(await request.json());
    const { memberId } = await context.params;
    const assignment = await assignAttendingDoctor({
      patientUserId: user.id,
      memberId,
      doctorProfileId: body.doctorProfileId,
    });
    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign attending doctor' },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;
    await revokeAttendingDoctor(user.id, memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke attending doctor' },
      { status: 401 }
    );
  }
}
