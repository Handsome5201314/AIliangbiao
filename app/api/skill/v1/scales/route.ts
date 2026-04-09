import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { listSkillScaleSummaries, listSkillScales } from '@/lib/assessment-skill/scale-service';

export async function GET(request: NextRequest) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    if (view === 'summary') {
      return NextResponse.json({
        scales: listSkillScaleSummaries(),
      });
    }

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
