import { NextRequest, NextResponse } from 'next/server';

import {
  buildAgentpitAppSession,
  decodeAgentpitSsoState,
  exchangeAgentpitCodeForToken,
  fetchAgentpitUserInfo,
  getAgentpitRequestOrigin,
  resolveLocalUserForAgentpit,
  sanitizeReturnUrl,
  serializeAuthUser,
} from '@/lib/auth/agentpit-oauth';

function buildErrorRedirect(request: NextRequest, code: string, returnUrl = '/') {
  const target = new URL('/auth/login', getAgentpitRequestOrigin(request));
  target.searchParams.set('sso_error', code);
  target.searchParams.set('returnUrl', sanitizeReturnUrl(returnUrl, '/'));
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const decodedState = decodeAgentpitSsoState(state);

  if (!code) {
    return buildErrorRedirect(request, 'missing_code', decodedState.returnUrl);
  }

  try {
    const { accessToken } = await exchangeAgentpitCodeForToken(request, code);
    const providerUser = await fetchAgentpitUserInfo(request, accessToken);
    const localUser = await resolveLocalUserForAgentpit(providerUser, decodedState.deviceId);
    const session = buildAgentpitAppSession(localUser);
    const encodedToken = encodeURIComponent(session.token);
    const encodedUser = encodeURIComponent(JSON.stringify(serializeAuthUser(localUser)));
    const encodedReturnUrl = encodeURIComponent(decodedState.returnUrl || '/');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AgentPit SSO</title>
  </head>
  <body>
    <script>
      window.location.replace('/auth/sso/callback?returnUrl=${encodedReturnUrl}#token=${encodedToken}&user=${encodedUser}');
    </script>
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[AgentPit Callback Error]:', error);
    return buildErrorRedirect(request, 'oauth_failed', decodedState.returnUrl);
  }
}
