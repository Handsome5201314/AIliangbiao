import crypto from 'node:crypto';

import { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AdminSessionPayload {
  sub: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || 'local-dev-admin-session-secret';
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getAdminSessionSecret())
      .update(`${header}.${payload}`)
      .digest()
  );
}

export function issueAdminSessionToken(input: {
  adminId: string;
  username: string;
  role: string;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: input.adminId,
    username: input.username,
    role: input.role,
    iat: now,
    exp: now + (input.ttlSeconds ?? ADMIN_SESSION_MAX_AGE_SECONDS),
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'AAS' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenParts(header, body);

  return {
    token: `${header}.${body}.${signature}`,
    payload,
  };
}

export function verifyAdminSessionToken(token: string): AdminSessionPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid admin session token');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid admin session signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as AdminSessionPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Admin session expired');
  }

  return payload;
}

export function getAdminSessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value || null;
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}
