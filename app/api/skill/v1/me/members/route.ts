import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { listAccessibleMembers } from '@/lib/assessment-skill/member-service';

export async function GET(request: NextRequest) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const members = await listAccessibleMembers(session.sub);
    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
