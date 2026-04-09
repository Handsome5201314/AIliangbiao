import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import type { NextRequest } from 'next/server';

type AdminTokenPayload = {
  sub: string;
  username: string;
  iat: number;
  exp: number;
};

const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 24;

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

function getAdminTokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET || process.env.SESSION_SECRET || 'local-dev-admin-token-secret';
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getAdminTokenSecret())
      .update(`${header}.${payload}`)
      .digest()
  );
}

export function issueAdminToken(input: { adminId: string; username: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: input.adminId,
    username: input.username,
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_SECONDS,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'ADM' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenParts(header, body);
  return `${header}.${body}.${signature}`;
}

function verifyAdminToken(token: string): AdminTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid admin token');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid admin token signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as AdminTokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Admin token expired');
  }

  return payload;
}

export async function requireAdminToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const token =
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : request.headers.get('x-admin-token');

  if (!token) {
    throw new Error('Unauthorized');
  }

  const payload = verifyAdminToken(token);
  const admin = await prisma.admin.findUnique({
    where: { id: payload.sub },
  });

  if (!admin) {
    throw new Error('Unauthorized');
  }

  return admin;
}
