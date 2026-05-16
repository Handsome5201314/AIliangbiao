import { NextRequest, NextResponse } from 'next/server';

import { getAgentpitRequestOrigin } from '@/lib/auth/agentpit-oauth';

export async function GET(request: NextRequest) {
  const target = new URL('/api/auth/agentpit/callback', getAgentpitRequestOrigin(request));
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target);
}
