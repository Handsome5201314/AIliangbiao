import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/user-session';
import { searchApprovedDoctors } from '@/lib/domain/care-service';

export async function GET(request: NextRequest) {
  try {
    await requirePatientUser(request);
    const query = new URL(request.url).searchParams.get('q') || '';
    const doctors = await searchApprovedDoctors(query);
    return NextResponse.json({ doctors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search doctors' },
      { status: 401 }
    );
  }
}
