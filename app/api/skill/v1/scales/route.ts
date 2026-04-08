import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { listSkillScales } from '@/lib/assessment-skill/scale-service';

export async function GET(request: NextRequest) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');

    return NextResponse.json({
      scales: listSkillScales(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
