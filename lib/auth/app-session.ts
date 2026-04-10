import crypto from 'node:crypto';

import { NextRequest } from 'next/server';

export type SessionAccountType = 'PATIENT' | 'DOCTOR';

export interface AppSessionPayload {
  sub: string;
  accountType: SessionAccountType;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  email?: string;
  doctorProfileId?: string;
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

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET || process.env.SESSION_SECRET || 'local-dev-app-session-secret';
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getSessionSecret())
      .update(`${header}.${payload}`)
      .digest()
  );
}

export function issueAppSessionToken(input: {
  userId: string;
  accountType: SessionAccountType;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  email?: string;
  doctorProfileId?: string;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AppSessionPayload = {
    sub: input.userId,
    accountType: input.accountType,
    role: input.role,
    email: input.email,
    doctorProfileId: input.doctorProfileId,
    iat: now,
    exp: now + (input.ttlSeconds ?? 60 * 60 * 24 * 7),
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'AUS' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenParts(header, body);

  return {
    token: `${header}.${body}.${signature}`,
    payload,
  };
}

export function verifyAppSessionToken(token: string): AppSessionPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid app session token');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid app session signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as AppSessionPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('App session token expired');
  }

  return payload;
}

export function extractAppBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer token');
  }

  return authHeader.slice('Bearer '.length).trim();
}
