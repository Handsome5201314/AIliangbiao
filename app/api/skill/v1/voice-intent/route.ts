import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';

export async function POST(request: NextRequest) {
  try {
    authenticateSkillRequest(request, 'skill:voice-intent');
    const body = await request.json();

    const forwardResponse = await fetch(getInternalApiUrl('/api/voice-intent', request), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await forwardResponse.text();
    return new NextResponse(text, {
      status: forwardResponse.status,
      headers: {
        'Content-Type': forwardResponse.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
