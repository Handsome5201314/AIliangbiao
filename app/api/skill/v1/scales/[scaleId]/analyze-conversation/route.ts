import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');
    const body = await request.json();
    const { scaleId } = await context.params;

    const proxied = await fetch(getInternalApiUrl('/api/scales/analyze-conversation', request), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        scaleId,
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
