'use client';

import { peekGuestSessionId } from '@/lib/utils/guestSession';

const SSO_ATTEMPT_KEY = 'agentpit_sso_attempted';
const AGENTPIT_REFERRER_HOST = 'app.agentpit.io';

function sanitizeReturnUrl(returnUrl?: string | null) {
  if (!returnUrl) {
    return '/';
  }

  if (returnUrl.startsWith('/')) {
    return returnUrl;
  }

  try {
    const parsed = new URL(returnUrl, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export function shouldAutoAgentpitSso() {
  if (typeof window === 'undefined') {
    return false;
  }

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (!path.startsWith('/agent')) {
    return false;
  }
  if (path.startsWith('/agent/auth/sso/callback')) {
    return false;
  }
  if (path.startsWith('/agent/api/auth/agentpit')) {
    return false;
  }
  if (params.has('sso_error') || params.get('agentpit_sso') === 'off') {
    return false;
  }
  if (sessionStorage.getItem(SSO_ATTEMPT_KEY)) {
    return false;
  }
  if (!document.referrer) {
    return false;
  }

  try {
    const referrer = new URL(document.referrer);
    return referrer.host === AGENTPIT_REFERRER_HOST;
  } catch {
    return false;
  }
}

export function markAgentpitSsoAttempted() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SSO_ATTEMPT_KEY, 'true');
  }
}

export function clearAgentpitSsoAttempted() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SSO_ATTEMPT_KEY);
  }
}

export function buildAgentpitSsoEntryUrl(returnUrl?: string | null) {
  const target = new URL('/api/auth/agentpit/sso', window.location.origin);
  target.searchParams.set('returnUrl', sanitizeReturnUrl(returnUrl));

  const deviceId = peekGuestSessionId();
  if (deviceId) {
    target.searchParams.set('deviceId', deviceId);
  }

  return target.toString();
}

export function redirectToAgentpitSso(returnUrl?: string | null) {
  markAgentpitSsoAttempted();
  window.location.assign(buildAgentpitSsoEntryUrl(returnUrl));
}
