import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { listDoctorPatients } from '@/lib/services/doctor-care';

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const consent = (searchParams.get('consent') || 'ALL') as 'GRANTED' | 'REVOKED' | 'ALL';

    const patients = await listDoctorPatients({
      doctorProfileId: doctorProfile.id,
      search,
      consent,
    });

    return NextResponse.json({ patients });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
