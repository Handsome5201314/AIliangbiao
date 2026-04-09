import { NextRequest, NextResponse } from 'next/server';

import { requireDoctorUser } from '@/lib/auth/user-session';
import { exportDoctorPatientData } from '@/lib/domain/care-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requireDoctorUser(request, { requireApproved: true });
    const { searchParams } = new URL(request.url);
    const { memberId } = await context.params;
    const exportType = searchParams.get('type') || 'csv';
    const purpose = searchParams.get('purpose') || undefined;
    const exportRange = searchParams.get('range') || undefined;

    const exported = await exportDoctorPatientData({
      doctorProfileId: user.doctorProfile!.id,
      memberId,
      exportType,
      purpose,
      exportRange,
    });

    return new NextResponse(exported.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"${exported.fileName}\"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export doctor patient data' },
      { status: 401 }
    );
  }
}
