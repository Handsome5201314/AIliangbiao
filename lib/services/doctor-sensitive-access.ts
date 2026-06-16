import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { getDoctorPatientDetail } from '@/lib/services/doctor-care';

export type SensitiveAccessTicketPayload = {
  sub: string;
  doctor_profile_id: string;
  member_id: string;
  organization_id?: string;
  purpose: string;
  ticket_id: string;
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

function getSensitiveAccessSecret() {
  return process.env.SENSITIVE_ACCESS_SECRET || process.env.SESSION_SECRET || 'local-dev-sensitive-access-secret';
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto
      .createHmac('sha256', getSensitiveAccessSecret())
      .update(`${header}.${payload}`)
      .digest()
  );
}

export function issueSensitiveAccessTicket(input: {
  userId: string;
  doctorProfileId: string;
  memberId: string;
  organizationId?: string | null;
  purpose: string;
  ttlMinutes: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SensitiveAccessTicketPayload = {
    sub: input.userId,
    doctor_profile_id: input.doctorProfileId,
    member_id: input.memberId,
    organization_id: input.organizationId || undefined,
    purpose: input.purpose.trim(),
    ticket_id: crypto.randomUUID(),
    iat: now,
    exp: now + Math.max(1, input.ttlMinutes) * 60,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'SAT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenParts(header, body);

  return {
    ticket: `${header}.${body}.${signature}`,
    payload,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifySensitiveAccessTicket(ticket: string) {
  const parts = ticket.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid sensitive access ticket');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid sensitive access ticket signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as SensitiveAccessTicketPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Sensitive access ticket expired');
  }

  return payload;
}

async function recordSensitiveAccessAudit(input: {
  actorUserId: string;
  doctorProfileId: string;
  organizationId?: string | null;
  memberId: string;
  purpose: string;
  ticketId: string;
  ttlMinutes: number;
}) {
  const auditLogModel = (prisma as any).auditLog;
  if (!auditLogModel?.create) {
    return;
  }

  await auditLogModel.create({
    data: {
      organizationId: input.organizationId || null,
      actorType: 'DOCTOR',
      actorUserId: input.actorUserId,
      actorDoctorProfileId: input.doctorProfileId,
      memberProfileId: input.memberId,
      targetType: 'MEMBER_PROFILE',
      targetId: input.memberId,
      action: 'SENSITIVE_ACCESS_REQUESTED',
      details: {
        purpose: input.purpose,
        ticketId: input.ticketId,
        ttlMinutes: input.ttlMinutes,
      },
    },
  });
}

export async function createDoctorSensitiveAccessTicket(input: {
  actorUserId: string;
  doctorProfileId: string;
  organizationId?: string | null;
  memberId: string;
  purpose: string;
  ttlMinutes: number;
}) {
  const detail = await getDoctorPatientDetail(input.doctorProfileId, input.memberId);
  const issued = issueSensitiveAccessTicket({
    userId: input.actorUserId,
    doctorProfileId: input.doctorProfileId,
    memberId: input.memberId,
    organizationId: input.organizationId,
    purpose: input.purpose,
    ttlMinutes: input.ttlMinutes,
  });

  await recordSensitiveAccessAudit({
    actorUserId: input.actorUserId,
    doctorProfileId: input.doctorProfileId,
    organizationId: input.organizationId,
    memberId: input.memberId,
    purpose: input.purpose.trim(),
    ticketId: issued.payload.ticket_id,
    ttlMinutes: input.ttlMinutes,
  });

  return {
    ticket: issued.ticket,
    expiresAt: issued.expiresAt,
    member: {
      id: detail.memberProfile.id,
      nickname: detail.memberProfile.nickname,
    },
    purpose: issued.payload.purpose,
  };
}
