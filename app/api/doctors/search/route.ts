import { NextRequest, NextResponse } from 'next/server';

import { getApprovedDoctors } from '@/lib/services/doctor-care';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const doctors = await getApprovedDoctors(query);

    return NextResponse.json({
      doctors: doctors.map((doctor) => ({
        id: doctor.id,
        realName: doctor.realName,
        hospitalName: doctor.hospitalName,
        departmentName: doctor.departmentName,
        title: doctor.title,
        verificationStatus: doctor.verificationStatus,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search doctors' },
      { status: 500 }
    );
  }
}
