import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');

  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  const proxied = await fetch(
    getInternalApiUrl(`/api/profile/sync?deviceId=${encodeURIComponent(deviceId)}`, request),
    { method: 'GET' }
  );

  const text = await proxied.text();
  return new NextResponse(text, {
    status: proxied.status,
    headers: {
      'Content-Type': proxied.headers.get('content-type') || 'application/json',
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const proxied = await fetch(getInternalApiUrl('/api/profile/sync', request), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await proxied.text();
  return new NextResponse(text, {
    status: proxied.status,
    headers: {
      'Content-Type': proxied.headers.get('content-type') || 'application/json',
    },
  });
}
