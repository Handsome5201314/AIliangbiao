import { NextRequest, NextResponse } from 'next/server';

import { requireDoctorUser } from '@/lib/auth/user-session';
import { listDoctorPatients } from '@/lib/domain/care-service';

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireDoctorUser(request, { requireApproved: true });
    const query = new URL(request.url).searchParams.get('q') || '';
    const patients = await listDoctorPatients(user.doctorProfile!.id, query);
    return NextResponse.json({ patients });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load doctor patients' },
      { status: 401 }
    );
  }
}
