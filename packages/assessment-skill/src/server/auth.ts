import crypto from 'node:crypto';

import { NextRequest } from 'next/server';

export type AgentScope =
  | 'skill:scales:read'
  | 'skill:scales:evaluate'
  | 'skill:voice-intent'
  | 'skill:member:read'
  | 'skill:memory:write';

export interface AgentSessionPayload {
  sub: string;
  member_id: string;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  scopes: AgentScope[];
  device_id: string;
  session_id: string;
  iat: number;
  exp: number;
}

const DEFAULT_AGENT_SCOPES: AgentScope[] = [
  'skill:scales:read',
  'skill:scales:evaluate',
  'skill:voice-intent',
  'skill:member:read',
  'skill:memory:write',
];

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

function getAgentSecret() {
  return process.env.AGENT_SESSION_SECRET || process.env.SESSION_SECRET || 'local-dev-agent-secret';
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getAgentSecret())
      .update(`${header}.${payload}`)
      .digest()
  );
}

export function issueAgentSessionToken(input: {
  userId: string;
  memberId: string;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  deviceId: string;
  scopes?: AgentScope[];
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AgentSessionPayload = {
    sub: input.userId,
    member_id: input.memberId,
    role: input.role,
    scopes: input.scopes ?? DEFAULT_AGENT_SCOPES,
    device_id: input.deviceId,
    session_id: crypto.randomUUID(),
    iat: now,
    exp: now + (input.ttlSeconds ?? 60 * 60 * 6),
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'AST' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenParts(header, body);

  return {
    token: `${header}.${body}.${signature}`,
    payload,
  };
}

export function verifyAgentSessionToken(token: string): AgentSessionPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid agent session token');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid agent session signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as AgentSessionPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Agent session token expired');
  }

  return payload;
}

export function extractBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer token');
  }

  return authHeader.slice('Bearer '.length).trim();
}

export function requireAgentScope(payload: AgentSessionPayload, scope: AgentScope) {
  if (!payload.scopes.includes(scope)) {
    throw new Error(`Missing required scope: ${scope}`);
  }
}
