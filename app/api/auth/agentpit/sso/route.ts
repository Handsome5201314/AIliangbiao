import { NextRequest, NextResponse } from 'next/server';

import { buildAgentpitAuthorizeUrl, sanitizeReturnUrl } from '@/lib/auth/agentpit-oauth';

export async function GET(request: NextRequest) {
  try {
    const returnUrl = sanitizeReturnUrl(request.nextUrl.searchParams.get('returnUrl'), '/');
    const deviceId = request.nextUrl.searchParams.get('deviceId') || undefined;
    const authorizeUrl = buildAgentpitAuthorizeUrl(request, {
      returnUrl,
      deviceId,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const fallback = new URL('/auth/login', request.nextUrl.origin);
    fallback.searchParams.set('sso_error', 'config_error');
    fallback.searchParams.set('returnUrl', sanitizeReturnUrl(request.nextUrl.searchParams.get('returnUrl'), '/'));

    console.error('[AgentPit SSO Entry Error]:', error);
    return NextResponse.redirect(fallback);
  }
}
