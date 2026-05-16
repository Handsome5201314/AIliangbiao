import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  if (!deviceId && !authHeader) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  const path = deviceId
    ? `/api/profile/sync?deviceId=${encodeURIComponent(deviceId)}`
    : '/api/profile/sync';
  const proxied = await fetch(
    getInternalApiUrl(path, request),
    {
      method: 'GET',
      headers: authHeader ? { Authorization: authHeader } : undefined,
    }
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
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const proxied = await fetch(getInternalApiUrl('/api/profile/sync', request), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
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
