import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { exportDoctorPatientResearchData } from '@/lib/services/doctor-care';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile, user } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'CSV').toUpperCase() as 'CSV' | 'JSON';
    const purpose = searchParams.get('purpose') || 'research';

    const exported = await exportDoctorPatientResearchData({
      doctorProfileId: doctorProfile.id,
      requestedByUserId: user.id,
      memberId,
      format,
      purpose,
    });

    return new NextResponse(exported.content, {
      status: 200,
      headers: {
        'Content-Type': exported.mimeType,
        'Content-Disposition': `attachment; filename=\"${exported.filename}\"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export research data' },
      { status: 401 }
    );
  }
}
