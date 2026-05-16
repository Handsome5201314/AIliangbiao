import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const proxied = await fetch(getInternalApiUrl('/api/account/upgrade', request), {
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
