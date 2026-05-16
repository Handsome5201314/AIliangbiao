import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { issueAppSessionToken, verifyAppSessionToken } from '@/lib/auth/app-session';
import { QuotaManager } from '@/lib/auth/quotaManager';

type AgentpitOAuthConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type AgentpitSsoState = {
  returnUrl: string;
  deviceId?: string;
};

type AgentpitUserInfo = {
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  rawProfile: Record<string, unknown>;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8')
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

export function sanitizeReturnUrl(returnUrl?: string | null, fallback = '/') {
  if (!returnUrl) {
    return fallback;
  }

  if (returnUrl.startsWith('/')) {
    return returnUrl;
  }

  try {
    const parsed = new URL(returnUrl);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function encodeAgentpitSsoState(input: AgentpitSsoState) {
  return `sso:${base64UrlEncode(JSON.stringify({
    returnUrl: sanitizeReturnUrl(input.returnUrl),
    deviceId: input.deviceId || undefined,
  }))}`;
}

export function decodeAgentpitSsoState(state?: string | null): AgentpitSsoState {
  if (!state?.startsWith('sso:')) {
    return { returnUrl: '/' };
  }

  const raw = state.slice(4);
  if (raw.startsWith('/')) {
    return { returnUrl: sanitizeReturnUrl(raw) };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(raw)) as AgentpitSsoState;
    return {
      returnUrl: sanitizeReturnUrl(parsed.returnUrl),
      deviceId: parsed.deviceId || undefined,
    };
  } catch {
    return { returnUrl: '/' };
  }
}

export function getAgentpitRequestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function getAgentpitOAuthConfig(request: NextRequest): AgentpitOAuthConfig {
  const origin = getAgentpitRequestOrigin(request);
  return {
    authorizeUrl: process.env.AGENTPIT_AUTHORIZE_URL || 'https://app.agentpit.io/api/oauth/authorize',
    tokenUrl: process.env.AGENTPIT_TOKEN_URL || 'https://app.agentpit.io/api/oauth/token',
    userinfoUrl: process.env.AGENTPIT_USERINFO_URL || 'https://app.agentpit.io/api/oauth/userinfo',
    clientId: process.env.AGENTPIT_CLIENT_ID || '',
    clientSecret: process.env.AGENTPIT_CLIENT_SECRET || '',
    redirectUri: process.env.AGENTPIT_REDIRECT_URI || `${origin}/api/auth/agentpit/callback`,
  };
}

export function buildAgentpitAuthorizeUrl(request: NextRequest, input: AgentpitSsoState) {
  const config = getAgentpitOAuthConfig(request);
  if (!config.clientId || !config.clientSecret) {
    throw new Error('AGENTPIT OAuth credentials are not configured');
  }

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('state', encodeAgentpitSsoState(input));

  return authorizeUrl.toString();
}

export async function exchangeAgentpitCodeForToken(request: NextRequest, code: string) {
  const config = getAgentpitOAuthConfig(request);
  const formData = new URLSearchParams();
  formData.set('grant_type', 'authorization_code');
  formData.set('code', code);
  formData.set('redirect_uri', config.redirectUri);
  formData.set('client_id', config.clientId);
  formData.set('client_secret', config.clientSecret);

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formData.toString(),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error_description?: string; error?: string }).error_description || (payload as { error?: string }).error || 'Failed to exchange AgentPit OAuth code');
  }

  const accessToken =
    (payload as { access_token?: string; data?: { access_token?: string } }).access_token ||
    (payload as { data?: { access_token?: string } }).data?.access_token;

  if (!accessToken) {
    throw new Error('AgentPit token endpoint returned no access_token');
  }

  return {
    accessToken,
    raw: payload,
  };
}

export async function fetchAgentpitUserInfo(request: NextRequest, accessToken: string): Promise<AgentpitUserInfo> {
  const config = getAgentpitOAuthConfig(request);
  const response = await fetch(config.userinfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error_description?: string; error?: string }).error_description || (payload as { error?: string }).error || 'Failed to fetch AgentPit userinfo');
  }

  const raw = (payload as Record<string, unknown>).user && typeof (payload as Record<string, unknown>).user === 'object'
    ? ((payload as Record<string, unknown>).user as Record<string, unknown>)
    : (payload as Record<string, unknown>);

  const providerUserId = String(raw.sub || raw.id || raw.user_id || raw.email || '').trim();
  if (!providerUserId) {
    throw new Error('AgentPit userinfo did not include a stable user identifier');
  }

  return {
    providerUserId,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    displayName:
      (typeof raw.name === 'string' && raw.name) ||
      (typeof raw.nickname === 'string' && raw.nickname) ||
      (typeof raw.preferred_username === 'string' && raw.preferred_username) ||
      undefined,
    avatarUrl:
      (typeof raw.picture === 'string' && raw.picture) ||
      (typeof raw.avatar === 'string' && raw.avatar) ||
      undefined,
    rawProfile: raw,
  };
}

async function ensureDefaultProfile(userId: string, profile: AgentpitUserInfo) {
  const existingCount = await prisma.memberProfile.count({
    where: { userId },
  });

  if (existingCount > 0) {
    return;
  }

  const nickname =
    profile.displayName ||
    profile.email?.split('@')[0] ||
    'AgentPit 用户';

  await prisma.memberProfile.create({
    data: {
      userId,
      relation: 'SELF',
      languagePreference: 'ZH',
      nickname,
      gender: 'boy',
      ageMonths: null,
      traits: {
        interests: [],
        fears: [],
      },
      avatarConfig: {},
    },
  });
}

async function findUserWithAuthShape(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      doctorProfile: true,
      profiles: true,
    },
  });
}

type AuthShapeUser = NonNullable<Awaited<ReturnType<typeof findUserWithAuthShape>>>;

export async function resolveLocalUserForAgentpit(profile: AgentpitUserInfo, deviceId?: string) {
  const existingIdentity = await prisma.agentpitIdentity.findUnique({
    where: { providerUserId: profile.providerUserId },
    include: {
      user: {
        include: {
          doctorProfile: true,
          profiles: true,
        },
      },
    },
  });

  let user = existingIdentity?.user || null;

  if (!user && profile.email && deviceId) {
    await QuotaManager.upgradeToRegisteredUser(deviceId, undefined, profile.email);
    user = await prisma.user.findUnique({
      where: { email: profile.email },
      include: {
        doctorProfile: true,
        profiles: true,
      },
    });
  }

  if (!user && profile.email) {
    user = await prisma.user.findUnique({
      where: { email: profile.email },
      include: {
        doctorProfile: true,
        profiles: true,
      },
    });
  }

  if (!user && deviceId) {
    const guestUser = await QuotaManager.getOrCreateGuest(deviceId);
    user = await prisma.user.update({
      where: { id: guestUser.id },
      data: {
        role: 'REGISTERED',
        isGuest: false,
        email: profile.email || guestUser.email,
        dailyLimit: guestUser.dailyLimit < 10 ? 10 : guestUser.dailyLimit,
      },
      include: {
        doctorProfile: true,
        profiles: true,
      },
    });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        role: 'REGISTERED',
        accountType: 'PATIENT',
        isGuest: false,
        email: profile.email || null,
        dailyLimit: 10,
      },
      include: {
        doctorProfile: true,
        profiles: true,
      },
    });
  }

  if (!existingIdentity) {
    await prisma.agentpitIdentity.create({
      data: {
        userId: user.id,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        rawProfile: profile.rawProfile as Prisma.InputJsonValue,
        lastLoginAt: new Date(),
      },
    });
  } else {
    await prisma.agentpitIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        rawProfile: profile.rawProfile as Prisma.InputJsonValue,
        lastLoginAt: new Date(),
      },
    });
  }

  if (profile.email && !user.email) {
    const emailOwner = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });

    if (!emailOwner || emailOwner.id === user.id) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email: profile.email },
        include: {
          doctorProfile: true,
          profiles: true,
        },
      });
    }
  }

  if (user.role === 'GUEST' || user.isGuest) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'REGISTERED',
        isGuest: false,
        dailyLimit: user.dailyLimit < 10 ? 10 : user.dailyLimit,
      },
      include: {
        doctorProfile: true,
        profiles: true,
      },
    });
  }

  if (deviceId && user.deviceId !== deviceId && profile.email) {
    try {
      await QuotaManager.upgradeToRegisteredUser(deviceId, undefined, profile.email);
      const mergedUser = await prisma.user.findUnique({
        where: { email: profile.email },
        include: {
          doctorProfile: true,
          profiles: true,
        },
      });
      if (mergedUser) {
        user = mergedUser;
      }
    } catch (error) {
      console.error('[AgentPit SSO Merge Error]:', error);
    }
  }

  await ensureDefaultProfile(user.id, profile);

  return (await findUserWithAuthShape(user.id)) || user;
}

export function buildAgentpitAppSession(user: AuthShapeUser) {
  return issueAppSessionToken({
    userId: user.id,
    accountType: user.accountType as 'PATIENT' | 'DOCTOR',
    role: user.role,
    email: user.email || undefined,
    doctorProfileId: user.doctorProfile?.id,
  });
}

export function serializeAuthUser(user: AuthShapeUser) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountType: user.accountType,
    doctorProfile: user.doctorProfile
      ? {
          id: user.doctorProfile.id,
          verificationStatus: user.doctorProfile.verificationStatus,
          realName: user.doctorProfile.realName,
          hospitalName: user.doctorProfile.hospitalName,
          departmentName: user.doctorProfile.departmentName,
          title: user.doctorProfile.title,
        }
      : null,
  };
}

export async function resolveAppUserFromOptionalAccessToken(accessToken?: string | null) {
  if (!accessToken) {
    return null;
  }

  try {
    const payload = verifyAppSessionToken(accessToken);
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
  } catch {
    return null;
  }
}
