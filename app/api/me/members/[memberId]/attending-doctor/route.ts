import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { assignDoctorToMember, getActiveDoctorAssignment, revokeDoctorAssignment } from '@/lib/services/doctor-care';

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
    const assignment = await getActiveDoctorAssignment(memberId);

    if (!assignment || assignment.memberProfile.userId !== user.id) {
      return NextResponse.json({ assignment: null });
    }

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        startedAt: assignment.startedAt,
        doctor: {
          id: assignment.doctorProfile.id,
          realName: assignment.doctorProfile.realName,
          hospitalName: assignment.doctorProfile.hospitalName,
          departmentName: assignment.doctorProfile.departmentName,
          title: assignment.doctorProfile.title,
          email: assignment.doctorProfile.user.email,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
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

    const assignment = await assignDoctorToMember({
      patientUserId: user.id,
      memberId,
      doctorProfileId: body.doctorProfileId,
    });

    return NextResponse.json({
      success: true,
      assignment,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign doctor' },
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
    await revokeDoctorAssignment(user.id, memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke attending doctor' },
      { status: 401 }
    );
  }
}
