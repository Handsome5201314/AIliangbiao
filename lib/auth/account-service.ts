import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db/prisma';
import { CURRENT_PRIVACY_CONSENT } from '@/lib/legal/privacyConsent';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { memberProfileModel } from '@/lib/domain/member-profile';

type ProfileDraft = {
  relation?: string;
  languagePreference?: string;
  nickname?: string;
  gender?: string;
  ageMonths?: number | null;
  interests?: string[];
  fears?: string[];
  avatarState?: unknown;
};

type DeviceUser = {
  id: string;
  email: string | null;
  phone: string | null;
  isGuest: boolean;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  accountType: 'PATIENT' | 'DOCTOR' | null;
  passwordHash: string | null;
  deviceId: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getRequestIpAddress(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }

  return request.headers.get('x-real-ip') || null;
}

function getRequestUserAgent(request: Request) {
  return request.headers.get('user-agent') || null;
}

async function createInitialMemberProfile(userId: string, profile?: ProfileDraft) {
  if (!profile?.nickname?.trim()) {
    return;
  }

  const model = memberProfileModel();
  const existing = await model.findFirst({
    where: { userId },
  });

  if (existing) {
    return;
  }

  await model.create({
    data: {
      userId,
      relation: String(profile.relation || 'SELF').toUpperCase(),
      languagePreference: String(profile.languagePreference || 'ZH').toUpperCase(),
      nickname: profile.nickname.trim(),
      gender: profile.gender || 'boy',
      ageMonths: profile.ageMonths || null,
      traits: {
        interests: profile.interests || [],
        fears: profile.fears || [],
      },
      avatarConfig: profile.avatarState || {},
    },
  });
}

async function recordPrivacyConsent(input: {
  userId: string;
  consentVersion: string;
  request: Request;
  source: 'REGISTER' | 'GUEST_UPGRADE';
}) {
  await prisma.userPrivacyConsent.create({
    data: {
      userId: input.userId,
      consentType: 'CLOUD_DATA_PRIVACY_RISK',
      documentVersion: input.consentVersion,
      acceptedAt: new Date(),
      ipAddress: getRequestIpAddress(input.request),
      userAgent: getRequestUserAgent(input.request),
      source: input.source,
    },
  });
}

async function mergeUserData(sourceUserId: string, targetUserId: string, deviceId: string) {
  if (sourceUserId === targetUserId) {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { deviceId },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "AssessmentHistory" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "AssessmentSession" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "TriageSession" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "McpLog" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "ApiKey" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "SpeechUsage" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "UserPrivacyConsent" SET "userId" = ${targetUserId} WHERE "userId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "ResearchConsent" SET "grantedByUserId" = ${targetUserId} WHERE "grantedByUserId" = ${sourceUserId}`;
    await tx.$executeRaw`UPDATE "CareAssignment" SET "assignedByPatientUserId" = ${targetUserId} WHERE "assignedByPatientUserId" = ${sourceUserId}`;
    await (tx.$executeRawUnsafe as any)(
      'UPDATE "ChildProfile" SET "userId" = $1 WHERE "userId" = $2',
      targetUserId,
      sourceUserId
    );

    await tx.user.update({
      where: { id: targetUserId },
      data: { deviceId },
    });

    await tx.user.delete({
      where: { id: sourceUserId },
    });
  });
}

async function bindDeviceToUser(targetUserId: string, deviceId: string) {
  const holder = await prisma.user.findUnique({
    where: { deviceId },
  }) as DeviceUser | null;

  if (!holder) {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { deviceId },
    });
    return;
  }

  if (holder.id === targetUserId) {
    return;
  }

  if (holder.isGuest && !holder.email && !holder.phone && !holder.accountType) {
    await mergeUserData(holder.id, targetUserId, deviceId);
    return;
  }

  await prisma.user.update({
    where: { id: holder.id },
    data: { deviceId: null },
  });

  await prisma.user.update({
    where: { id: targetUserId },
    data: { deviceId },
  });
}

export async function registerPatientAccount(input: {
  deviceId: string;
  email: string;
  password: string;
  consentAccepted: boolean;
  consentVersion: string;
  request: Request;
  profile?: ProfileDraft;
}) {
  if (!input.consentAccepted) {
    throw new Error('请先勾选隐私风险知情同意书');
  }

  if (input.consentVersion !== CURRENT_PRIVACY_CONSENT.version) {
    throw new Error('隐私知情同意书版本已更新，请重新确认');
  }

  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
  }) as DeviceUser | null;

  if (existingUser) {
    throw new Error('该邮箱已注册，请直接登录');
  }

  const guestUser = await QuotaManager.getOrCreateGuest(input.deviceId) as unknown as DeviceUser;
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.update({
    where: { id: guestUser.id },
    data: {
      email,
      passwordHash,
      accountType: 'PATIENT',
      role: 'REGISTERED',
      isGuest: false,
    },
  });

  await createInitialMemberProfile(user.id, input.profile);
  await recordPrivacyConsent({
    userId: user.id,
    consentVersion: input.consentVersion,
    request: input.request,
    source: 'REGISTER',
  });

  return user;
}

export async function upgradeGuestToPatientAccount(input: {
  deviceId: string;
  email: string;
  password: string;
  consentAccepted: boolean;
  consentVersion: string;
  request: Request;
  profile?: ProfileDraft;
}) {
  if (!input.consentAccepted) {
    throw new Error('请先勾选隐私风险知情同意书');
  }

  if (input.consentVersion !== CURRENT_PRIVACY_CONSENT.version) {
    throw new Error('隐私知情同意书版本已更新，请重新确认');
  }

  const email = normalizeEmail(input.email);
  const guestUser = await QuotaManager.getOrCreateGuest(input.deviceId) as unknown as DeviceUser;
  const existingUser = await prisma.user.findUnique({
    where: { email },
  }) as DeviceUser | null;

  if (existingUser && existingUser.id !== guestUser.id) {
    if (!existingUser.passwordHash) {
      throw new Error('目标账号缺少密码，请联系管理员处理');
    }

    const passwordMatches = await bcrypt.compare(input.password, existingUser.passwordHash);
    if (!passwordMatches) {
      throw new Error('邮箱已存在且密码不匹配');
    }

    await mergeUserData(guestUser.id, existingUser.id, input.deviceId);
    await createInitialMemberProfile(existingUser.id, input.profile);
    await recordPrivacyConsent({
      userId: existingUser.id,
      consentVersion: input.consentVersion,
      request: input.request,
      source: 'GUEST_UPGRADE',
    });

    return await prisma.user.findUniqueOrThrow({
      where: { id: existingUser.id },
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const upgraded = await prisma.user.update({
    where: { id: guestUser.id },
    data: {
      email,
      passwordHash,
      accountType: 'PATIENT',
      role: 'REGISTERED',
      isGuest: false,
    },
  });

  await createInitialMemberProfile(upgraded.id, input.profile);
  await recordPrivacyConsent({
    userId: upgraded.id,
    consentVersion: input.consentVersion,
    request: input.request,
    source: 'GUEST_UPGRADE',
  });

  return upgraded;
}

export async function registerDoctorAccount(input: {
  email: string;
  password: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  licenseNo: string;
}) {
  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('该邮箱已注册');
  }

  const existingLicense = await prisma.doctorProfile.findUnique({
    where: { licenseNo: input.licenseNo },
  });
  if (existingLicense) {
    throw new Error('该执业证号已存在');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      accountType: 'DOCTOR',
      role: 'REGISTERED',
      isGuest: false,
    },
  });

  await prisma.doctorProfile.create({
    data: {
      userId: user.id,
      realName: input.realName.trim(),
      hospitalName: input.hospitalName.trim(),
      departmentName: input.departmentName.trim(),
      title: input.title.trim(),
      licenseNo: input.licenseNo.trim(),
      verificationStatus: 'PENDING',
    },
  });

  return await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { doctorProfile: true },
  });
}

export async function loginAccount(input: {
  email: string;
  password: string;
  deviceId?: string;
}) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { doctorProfile: true },
  });

  if (!user?.passwordHash || !user.accountType) {
    throw new Error('账号或密码错误');
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new Error('账号或密码错误');
  }

  if (input.deviceId && user.accountType === 'PATIENT') {
    await bindDeviceToUser(user.id, input.deviceId);
  }

  return await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { doctorProfile: true },
  });
}
