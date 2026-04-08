import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const { memberId } = await context.params;
    if (memberId !== session.member_id) {
      return NextResponse.json({ error: 'Forbidden member access' }, { status: 403 });
    }

    const body = await request.json();
    const proxied = await fetch(getInternalApiUrl('/api/assessment/generate-advice', request), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        deviceId: session.device_id,
      }),
    });

    const text = await proxied.text();
    return new NextResponse(text, {
      status: proxied.status,
      headers: {
        'Content-Type': proxied.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
