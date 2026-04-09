import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import type { NextRequest, NextResponse } from 'next/server';

const USER_SESSION_COOKIE = 'app_user_session';
const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AppSessionPayload = {
  sub: string;
  accountType: 'PATIENT' | 'DOCTOR';
  iat: number;
  exp: number;
};

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

function getUserSessionSecret() {
  return process.env.USER_SESSION_SECRET || process.env.SESSION_SECRET || 'local-dev-user-session-secret';
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getUserSessionSecret())
      .update(`${header}.${payload}`)
      .digest()
  );
}

function issueUserSessionToken(input: { userId: string; accountType: 'PATIENT' | 'DOCTOR' }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AppSessionPayload = {
    sub: input.userId,
    accountType: input.accountType,
    iat: now,
    exp: now + USER_SESSION_TTL_SECONDS,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'APP' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenParts(header, body);
  return `${header}.${body}.${signature}`;
}

function verifyUserSessionToken(token: string): AppSessionPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid user session token');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid user session signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as AppSessionPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('User session token expired');
  }

  return payload;
}

export function attachUserSessionCookie(
  response: NextResponse,
  input: { userId: string; accountType: 'PATIENT' | 'DOCTOR' }
) {
  response.cookies.set({
    name: USER_SESSION_COOKIE,
    value: issueUserSessionToken(input),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: USER_SESSION_TTL_SECONDS,
  });
}

export function clearUserSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: USER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get(USER_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const payload = verifyUserSessionToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      doctorProfile: true,
    },
  });

  if (!user || !user.accountType) {
    return null;
  }

  return {
    payload,
    user,
  };
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const authenticated = await getAuthenticatedUser(request);
  if (!authenticated) {
    throw new Error('Unauthorized');
  }

  return authenticated;
}

export async function requirePatientUser(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (authenticated.user.accountType !== 'PATIENT') {
    throw new Error('Forbidden');
  }

  return authenticated;
}

export async function requireDoctorUser(request: NextRequest, options?: { requireApproved?: boolean }) {
  const authenticated = await requireAuthenticatedUser(request);
  if (authenticated.user.accountType !== 'DOCTOR' || !authenticated.user.doctorProfile) {
    throw new Error('Forbidden');
  }

  if (options?.requireApproved && authenticated.user.doctorProfile.verificationStatus !== 'APPROVED') {
    throw new Error('Doctor verification pending');
  }

  return authenticated;
}
