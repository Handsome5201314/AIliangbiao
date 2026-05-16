import crypto from 'node:crypto';

import { AuthVerificationPurpose } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { sendTencentAuthCodeSms } from '@/lib/services/tencentSms';
import { normalizeOptionalPhone } from '@/lib/utils/contact';

export type VerificationPurpose = 'register' | 'login' | 'reset_password';

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 60 * 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const purposeMap: Record<VerificationPurpose, AuthVerificationPurpose> = {
  register: AuthVerificationPurpose.REGISTER,
  login: AuthVerificationPurpose.LOGIN,
  reset_password: AuthVerificationPurpose.RESET_PASSWORD,
};

export class AuthVerificationError extends Error {
  status: number;
  cooldownSeconds?: number;
  expiresInSeconds?: number;

  constructor(message: string, status = 400, extras?: { cooldownSeconds?: number; expiresInSeconds?: number }) {
    super(message);
    this.name = 'AuthVerificationError';
    this.status = status;
    this.cooldownSeconds = extras?.cooldownSeconds;
    this.expiresInSeconds = extras?.expiresInSeconds;
  }
}

function getHashSecret() {
  return process.env.SESSION_SECRET || process.env.APP_SESSION_SECRET || 'local-dev-auth-verification-secret';
}

function hashCode(phone: string, purpose: VerificationPurpose, code: string) {
  return crypto
    .createHmac('sha256', getHashSecret())
    .update(`${phone}:${purpose}:${code}`)
    .digest('hex');
}

function generateVerificationCode() {
  const max = 10 ** CODE_LENGTH;
  return String(Math.floor(Math.random() * max)).padStart(CODE_LENGTH, '0');
}

export function normalizeVerificationPhone(phone: string) {
  const normalized = normalizeOptionalPhone(phone);
  if (!normalized) {
    throw new AuthVerificationError('请输入有效手机号', 400);
  }

  return normalized;
}

async function getLatestActiveCode(phone: string, purpose: VerificationPurpose) {
  return prisma.authVerificationCode.findFirst({
    where: {
      phone,
      purpose: purposeMap[purpose],
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function assertCanSendCode(phone: string, purpose: VerificationPurpose) {
  const latest = await prisma.authVerificationCode.findFirst({
    where: {
      phone,
      purpose: purposeMap[purpose],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (latest) {
    const cooldownSeconds = RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
    if (cooldownSeconds > 0) {
      throw new AuthVerificationError('请求过于频繁，请稍后再试', 429, {
        cooldownSeconds,
        expiresInSeconds: Math.max(0, Math.floor((latest.expiresAt.getTime() - Date.now()) / 1000)),
      });
    }
  }

  const sentCount = await prisma.authVerificationCode.count({
    where: {
      phone,
      purpose: purposeMap[purpose],
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
  });

  if (sentCount >= MAX_SENDS_PER_HOUR) {
    throw new AuthVerificationError('该手机号发送验证码过于频繁，请一小时后再试', 429);
  }
}

export async function sendVerificationCode(input: {
  phone: string;
  purpose: VerificationPurpose;
}) {
  const phone = normalizeVerificationPhone(input.phone);
  await assertCanSendCode(phone, input.purpose);

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

  await prisma.authVerificationCode.create({
    data: {
      phone,
      purpose: purposeMap[input.purpose],
      codeHash: hashCode(phone, input.purpose, code),
      expiresAt,
    },
  });

  await sendTencentAuthCodeSms({
    phone,
    code,
    purpose: input.purpose,
    ttlMinutes: Math.floor(CODE_TTL_SECONDS / 60),
  });

  return {
    success: true,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    expiresInSeconds: CODE_TTL_SECONDS,
  };
}

export async function verifyVerificationCode(input: {
  phone: string;
  purpose: VerificationPurpose;
  code: string;
}) {
  const phone = normalizeVerificationPhone(input.phone);
  const latest = await getLatestActiveCode(phone, input.purpose);

  if (!latest) {
    throw new AuthVerificationError('验证码不存在或已失效', 400);
  }

  if (latest.expiresAt.getTime() <= Date.now()) {
    throw new AuthVerificationError('验证码已过期，请重新获取', 400);
  }

  if (latest.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    throw new AuthVerificationError('验证码输入次数过多，请重新获取', 429);
  }

  const codeHash = hashCode(phone, input.purpose, input.code.trim());
  if (codeHash !== latest.codeHash) {
    await prisma.authVerificationCode.update({
      where: { id: latest.id },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new AuthVerificationError('验证码错误', 400);
  }

  await prisma.authVerificationCode.update({
    where: { id: latest.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return {
    success: true,
    phone,
  };
}
