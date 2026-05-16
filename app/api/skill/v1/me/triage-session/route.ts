import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';

export async function GET(request: NextRequest) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const proxied = await fetch(getInternalApiUrl(`/api/triage/session?deviceId=${encodeURIComponent(session.device_id)}`, request), {
      method: 'GET',
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

export async function POST(request: NextRequest) {
  try {
    const session = authenticateSkillRequest(request, 'skill:member:read');
    const body = await request.json();
    const proxied = await fetch(getInternalApiUrl('/api/triage/session', request), {
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

export async function DELETE(request: NextRequest) {
  try {
    authenticateSkillRequest(request, 'skill:member:read');
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const proxied = await fetch(getInternalApiUrl(`/api/triage/session?sessionId=${encodeURIComponent(sessionId || '')}`, request), {
      method: 'DELETE',
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
