import crypto from 'node:crypto';

import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { getLatestActiveAssessmentSession } from '@/lib/assessment-skill/scale-service';
import { getScaleDefinitionById } from '@/lib/scales/catalog';

const expertConfigSchema = z.object({
  key: z.string().min(1),
  shareId: z.string().min(1),
  label: z.string().optional(),
  labelZh: z.string().optional(),
  labelEn: z.string().optional(),
  description: z.string().optional(),
  descriptionZh: z.string().optional(),
  descriptionEn: z.string().optional(),
  audience: z.enum(['patient', 'doctor', 'all']).optional(),
  tags: z.array(z.string()).optional(),
});

const shareFinishRecordSchema = z.object({
  moduleName: z.string().optional(),
  moduleType: z.string().optional(),
  totalPoints: z.number().optional(),
  price: z.number().optional(),
  tokens: z.number().optional(),
  model: z.string().optional(),
  runningTime: z.number().optional(),
});

export type FastgptExpertConfig = z.infer<typeof expertConfigSchema>;

export type FastgptPublicExpert = {
  key: string;
  label: string;
  description: string;
  tags: string[];
  recommended: boolean;
};

export type FastgptEmbedSession = {
  uid: string;
  embedUrl: string;
  externalUrl: string;
  expiresAt: string;
  refreshAfterSeconds: number;
  expert: FastgptPublicExpert;
  experts: FastgptPublicExpert[];
  context: {
    memberId: string;
    memberNickname: string;
    relation: string | null;
    language: 'zh' | 'en';
    ageMonths: number | null;
    currentScaleId: string | null;
    latestAssessmentScaleId: string | null;
    hasActiveAssessment: boolean;
  };
};

type FastgptEmbedTokenPayload = {
  sub: string;
  memberId: string;
  uid: string;
  accountType: 'PATIENT' | 'DOCTOR';
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  deviceIdHash: string;
  scene: 'agent';
  language: 'zh' | 'en';
  expertKey: string;
  relation: string | null;
  ageMonths: number | null;
  currentScaleId: string | null;
  latestAssessmentScaleId: string | null;
  iat: number;
  exp: number;
};

type ResolvedEmbedActor = {
  userId: string;
  memberId: string;
  deviceId: string;
  accountType: 'PATIENT' | 'DOCTOR';
  role: 'GUEST' | 'REGISTERED' | 'VIP';
};

type FastgptAuthValidationResult =
  | {
      ok: true;
      payload: FastgptEmbedTokenPayload;
      expert: FastgptExpertConfig;
      user: {
        id: string;
        accountType: 'PATIENT' | 'DOCTOR';
      };
      member: {
        id: string;
        userId: string;
      };
    }
  | {
      ok: false;
      message: string;
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

function normalizeLanguage(value?: string | null) {
  return String(value || '').toLowerCase() === 'en' ? 'en' : 'zh';
}

function safeNumber(value: string | undefined, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function sanitizeUidSegment(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 80) || 'na';
}

function hashDeviceId(deviceId: string) {
  return crypto.createHash('sha256').update(deviceId).digest('hex').slice(0, 24);
}

function getFastgptEmbedSecret() {
  return (
    process.env.FASTGPT_EMBED_TOKEN_SECRET ||
    process.env.AGENT_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    'local-dev-fastgpt-embed-secret'
  );
}

function signTokenParts(header: string, payload: string) {
  return base64UrlEncode(
    crypto.createHmac('sha256', getFastgptEmbedSecret()).update(`${header}.${payload}`).digest()
  );
}

function buildFallbackExpertConfigs(): FastgptExpertConfig[] {
  const fallback: FastgptExpertConfig[] = [];

  if (process.env.FASTGPT_PSYCHOLOGY_SHARE_ID) {
    fallback.push({
      key: 'psychology',
      shareId: process.env.FASTGPT_PSYCHOLOGY_SHARE_ID,
      labelZh: '心理科专家',
      labelEn: 'Psychology Expert',
      descriptionZh: '适合情绪、心理、量表解释与指南依据类问题。',
      descriptionEn: 'Best for mental health, scale interpretation, and guideline questions.',
      tags: ['psychology', 'mental-health'],
      audience: 'patient',
    });
  }

  if (process.env.FASTGPT_PEDIATRICS_SHARE_ID) {
    fallback.push({
      key: 'pediatrics',
      shareId: process.env.FASTGPT_PEDIATRICS_SHARE_ID,
      labelZh: '儿科专家',
      labelEn: 'Pediatrics Expert',
      descriptionZh: '适合儿童发育、行为表现、筛查路径与儿科常见问题。',
      descriptionEn: 'Best for pediatrics, development, behavior, and screening pathway questions.',
      tags: ['pediatrics', 'child-development'],
      audience: 'patient',
    });
  }

  if (process.env.FASTGPT_SHARE_ID) {
    fallback.push({
      key: 'general',
      shareId: process.env.FASTGPT_SHARE_ID,
      labelZh: '知识助理',
      labelEn: 'Knowledge Assistant',
      descriptionZh: '通用知识问答入口，适合文献、指南和量表说明。',
      descriptionEn: 'General knowledge assistant for literature, guidelines, and scale explanations.',
      tags: ['general'],
      audience: 'patient',
    });
  }

  return fallback;
}

function getConfiguredExperts() {
  const configured = process.env.FASTGPT_EXPERTS_JSON?.trim();
  if (configured) {
    try {
      const parsed = z.array(expertConfigSchema).parse(JSON.parse(configured));
      return parsed;
    } catch (error) {
      console.error('[FastGPT] Failed to parse FASTGPT_EXPERTS_JSON:', error);
    }
  }

  return buildFallbackExpertConfigs();
}

function getFastgptConfig() {
  const experts = getConfiguredExperts().filter((expert) => {
    if (expert.audience === 'doctor') {
      return false;
    }
    return Boolean(expert.shareId);
  });

  return {
    enabled: experts.length > 0,
    experts,
    defaultExpertKey: process.env.FASTGPT_DEFAULT_EXPERT_KEY?.trim() || '',
    shareBaseUrl: process.env.FASTGPT_SHARE_BASE_URL?.trim() || 'https://share.fastgpt.io/chat/share',
    ttlSeconds: safeNumber(process.env.FASTGPT_EMBED_TOKEN_TTL_SECONDS, 60 * 60 * 6),
    refreshLeewaySeconds: safeNumber(process.env.FASTGPT_EMBED_REFRESH_LEEWAY_SECONDS, 60 * 5),
    blockedTerms: String(process.env.FASTGPT_BLOCKED_TERMS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function localizeExpertText(
  expert: FastgptExpertConfig,
  language: 'zh' | 'en',
  field: 'label' | 'description'
) {
  if (field === 'label') {
    if (language === 'en') {
      return expert.labelEn || expert.label || expert.labelZh || expert.key;
    }
    return expert.labelZh || expert.label || expert.labelEn || expert.key;
  }

  if (language === 'en') {
    return expert.descriptionEn || expert.description || expert.descriptionZh || '';
  }
  return expert.descriptionZh || expert.description || expert.descriptionEn || '';
}

function buildPublicExpert(
  expert: FastgptExpertConfig,
  language: 'zh' | 'en',
  recommended: boolean
): FastgptPublicExpert {
  return {
    key: expert.key,
    label: localizeExpertText(expert, language, 'label'),
    description: localizeExpertText(expert, language, 'description'),
    tags: expert.tags || [],
    recommended,
  };
}

function resolveCategoryExpertPreference(currentScaleId?: string | null) {
  if (!currentScaleId) {
    return null;
  }

  const scale = getScaleDefinitionById(currentScaleId);
  const category = String(scale?.category || '').toLowerCase();

  if (
    category.includes('mental') ||
    category.includes('personality') ||
    category.includes('career') ||
    category.includes('general health')
  ) {
    return 'psychology';
  }

  if (
    category.includes('child') ||
    category.includes('cognitive') ||
    ['ABC', 'ATEC', 'CARS', 'SRS', 'M-CHAT-R', 'SNAP-IV', 'MMSE', 'MOCA'].includes(
      currentScaleId.toUpperCase()
    )
  ) {
    return 'pediatrics';
  }

  return null;
}

function findExpertAlias(experts: FastgptExpertConfig[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((item) => item.toLowerCase()));
  return (
    experts.find((expert) => aliasSet.has(expert.key.toLowerCase())) ||
    experts.find((expert) => (expert.tags || []).some((tag) => aliasSet.has(tag.toLowerCase()))) ||
    null
  );
}

function resolveExpertSelection(input: {
  experts: FastgptExpertConfig[];
  defaultExpertKey?: string;
  requestedExpertKey?: string;
  ageMonths?: number | null;
  currentScaleId?: string | null;
}) {
  if (!input.experts.length) {
    throw new Error('FastGPT knowledge panel is not configured');
  }

  if (input.requestedExpertKey) {
    const requested = input.experts.find(
      (expert) => expert.key.toLowerCase() === input.requestedExpertKey!.toLowerCase()
    );
    if (!requested) {
      throw new Error('Requested FastGPT expert is not available');
    }
    return requested;
  }

  const preferredByScale = resolveCategoryExpertPreference(input.currentScaleId);
  const psychologyExpert = findExpertAlias(input.experts, ['psychology', 'psych', 'mental-health']);
  const pediatricsExpert = findExpertAlias(input.experts, ['pediatrics', 'pediatric', 'child']);
  const generalExpert = findExpertAlias(input.experts, ['general', 'default', 'knowledge']);

  if (preferredByScale === 'psychology' && psychologyExpert) {
    return psychologyExpert;
  }

  if (preferredByScale === 'pediatrics' && pediatricsExpert) {
    return pediatricsExpert;
  }

  if (typeof input.ageMonths === 'number' && input.ageMonths > 0 && input.ageMonths <= 216 && pediatricsExpert) {
    return pediatricsExpert;
  }

  if (input.defaultExpertKey) {
    const configuredDefault = input.experts.find(
      (expert) => expert.key.toLowerCase() === input.defaultExpertKey!.toLowerCase()
    );
    if (configuredDefault) {
      return configuredDefault;
    }
  }

  return generalExpert || psychologyExpert || pediatricsExpert || input.experts[0];
}

function issueFastgptEmbedToken(payload: Omit<FastgptEmbedTokenPayload, 'iat' | 'exp'>) {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = getFastgptConfig().ttlSeconds;
  const signedPayload: FastgptEmbedTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'FGS' }));
  const body = base64UrlEncode(JSON.stringify(signedPayload));
  const signature = signTokenParts(header, body);

  return {
    token: `${header}.${body}.${signature}`,
    payload: signedPayload,
  };
}

function verifyFastgptEmbedToken(token: string): FastgptEmbedTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid FastGPT embed token');
  }

  const [header, body, signature] = parts;
  const expected = signTokenParts(header, body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid FastGPT embed signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as FastgptEmbedTokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('FastGPT embed token expired');
  }

  return payload;
}

function buildFastgptUid(input: {
  userId: string;
  memberId: string;
  deviceIdHash: string;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  expertKey: string;
}) {
  const prefix =
    input.role === 'GUEST'
      ? `g_${sanitizeUidSegment(input.deviceIdHash)}`
      : `u_${sanitizeUidSegment(input.userId)}`;

  return `${prefix}__m_${sanitizeUidSegment(input.memberId)}__agent__x_${sanitizeUidSegment(input.expertKey)}`;
}

function buildFastgptShareUrl(shareId: string, authToken: string) {
  const base = getFastgptConfig().shareBaseUrl;
  const target = new URL(base);
  target.searchParams.set('shareId', shareId);
  target.searchParams.set('authToken', authToken);
  return target.toString();
}

async function loadMemberProfile(userId: string, memberId: string) {
  const member = await (prisma as any).memberProfile.findFirst({
    where: {
      id: memberId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      nickname: true,
      relation: true,
      languagePreference: true,
      ageMonths: true,
    },
  });

  if (!member) {
    throw new Error('Member not found or not accessible');
  }

  return member as {
    id: string;
    userId: string;
    nickname: string;
    relation: string | null;
    languagePreference: string | null;
    ageMonths: number | null;
  };
}

async function loadLatestAssessmentSummary(userId: string, memberId: string) {
  const latestAssessment = await prisma.assessmentHistory.findFirst({
    where: {
      userId,
      profileId: memberId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      scaleId: true,
      createdAt: true,
    },
  });

  return latestAssessment;
}

export async function createFastgptEmbedSession(input: ResolvedEmbedActor & { expertKey?: string }) {
  const config = getFastgptConfig();
  if (!config.enabled) {
    throw new Error('FastGPT knowledge panel is not configured');
  }

  if (input.accountType !== 'PATIENT') {
    throw new Error('FastGPT knowledge panel is only available for patient workspace');
  }

  const [member, activeAssessment, latestAssessment] = await Promise.all([
    loadMemberProfile(input.userId, input.memberId),
    getLatestActiveAssessmentSession({
      userId: input.userId,
      profileId: input.memberId,
    }),
    loadLatestAssessmentSummary(input.userId, input.memberId),
  ]);

  const deviceIdHash = hashDeviceId(input.deviceId);
  const language = normalizeLanguage(member.languagePreference);
  const currentScaleId = activeAssessment?.scaleId || latestAssessment?.scaleId || null;
  const selectedExpert = resolveExpertSelection({
    experts: config.experts,
    defaultExpertKey: config.defaultExpertKey,
    requestedExpertKey: input.expertKey,
    ageMonths: member.ageMonths,
    currentScaleId,
  });

  const uid = buildFastgptUid({
    userId: input.userId,
    memberId: input.memberId,
    deviceIdHash,
    role: input.role,
    expertKey: selectedExpert.key,
  });

  const { token, payload } = issueFastgptEmbedToken({
    sub: input.userId,
    memberId: input.memberId,
    uid,
    accountType: input.accountType,
    role: input.role,
    deviceIdHash,
    scene: 'agent',
    language,
    expertKey: selectedExpert.key,
    relation: member.relation ? String(member.relation).toLowerCase() : null,
    ageMonths: member.ageMonths ?? null,
    currentScaleId,
    latestAssessmentScaleId: latestAssessment?.scaleId || null,
  });

  const publicExperts = config.experts.map((expert) =>
    buildPublicExpert(expert, language, expert.key === selectedExpert.key)
  );
  const embedUrl = buildFastgptShareUrl(selectedExpert.shareId, token);
  const refreshAfterSeconds = Math.max(60, config.ttlSeconds - config.refreshLeewaySeconds);

  return {
    uid,
    embedUrl,
    externalUrl: embedUrl,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    refreshAfterSeconds,
    expert: publicExperts.find((expert) => expert.key === selectedExpert.key)!,
    experts: publicExperts,
    context: {
      memberId: member.id,
      memberNickname: member.nickname,
      relation: member.relation ? String(member.relation).toLowerCase() : null,
      language,
      ageMonths: member.ageMonths ?? null,
      currentScaleId,
      latestAssessmentScaleId: latestAssessment?.scaleId || null,
      hasActiveAssessment: Boolean(activeAssessment),
    },
  } satisfies FastgptEmbedSession;
}

function buildAuthFailure(message: string) {
  return {
    success: false,
    message,
    msg: message,
  };
}

function buildAuthSuccess(uid: string) {
  return {
    success: true,
    data: {
      uid,
    },
  };
}

export async function validateFastgptShareToken(token: string): Promise<FastgptAuthValidationResult> {
  const config = getFastgptConfig();
  if (!config.enabled) {
    return {
      ok: false,
      message: 'FastGPT knowledge panel is not configured',
    };
  }

  try {
    const payload = verifyFastgptEmbedToken(token);
    if (payload.scene !== 'agent') {
      return { ok: false, message: 'Unsupported FastGPT scene' };
    }

    const expert = config.experts.find(
      (item) => item.key.toLowerCase() === payload.expertKey.toLowerCase()
    );
    if (!expert) {
      return { ok: false, message: 'FastGPT expert is not available' };
    }

    const [user, member] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, accountType: true },
      }),
      (prisma as any).memberProfile.findFirst({
        where: {
          id: payload.memberId,
          userId: payload.sub,
        },
        select: { id: true, userId: true },
      }),
    ]);

    if (!user || user.accountType !== 'PATIENT') {
      return { ok: false, message: 'Patient workspace session is not available' };
    }

    if (!member) {
      return { ok: false, message: 'Member access is no longer valid' };
    }

    return {
      ok: true,
      payload,
      expert,
      user,
      member,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid FastGPT token',
    };
  }
}

function containsOperationalIntent(question: string) {
  return [
    /开始.{0,4}(量表|评估|测试)/i,
    /(启动|提交|取消).{0,6}(量表|评估|测试)/i,
    /(切换|更换).{0,4}(成员|档案)/i,
    /(邀请|联系).{0,4}医生/i,
    /导出.{0,4}(报告|档案|快照)/i,
    /start.{0,6}(assessment|scale|test)/i,
    /(submit|cancel).{0,8}(assessment|scale|test)/i,
    /switch.{0,4}member/i,
    /invite.{0,4}doctor/i,
    /export.{0,6}(report|snapshot|profile)/i,
  ].some((pattern) => pattern.test(question));
}

function containsBlockedTerms(question: string, blockedTerms: string[]) {
  return blockedTerms.some((term) => question.toLowerCase().includes(term.toLowerCase()));
}

export async function handleFastgptShareInit(token: string) {
  const validated = await validateFastgptShareToken(token);
  if (!validated.ok) {
    return buildAuthFailure(validated.message);
  }

  return buildAuthSuccess(validated.payload.uid);
}

export async function handleFastgptShareStart(input: { token: string; question?: string }) {
  const validated = await validateFastgptShareToken(input.token);
  if (!validated.ok) {
    return buildAuthFailure(validated.message);
  }

  const question = String(input.question || '').trim();
  if (!question) {
    return buildAuthFailure('请输入问题后再继续。');
  }

  if (question.length > 2000) {
    return buildAuthFailure('问题过长，请缩短后再试。');
  }

  const config = getFastgptConfig();
  if (containsBlockedTerms(question, config.blockedTerms)) {
    return buildAuthFailure('该问题暂不支持在知识面板中处理。');
  }

  if (containsOperationalIntent(question)) {
    return buildAuthFailure('知识面板只提供文献和解释，不处理量表、成员或医生操作。请返回主工作台继续。');
  }

  return buildAuthSuccess(validated.payload.uid);
}

export async function handleFastgptShareFinish(input: {
  token: string;
  responseData?: unknown;
}) {
  const validated = await validateFastgptShareToken(input.token);
  if (!validated.ok) {
    return buildAuthFailure(validated.message);
  }

  const parsedRecords = z.array(shareFinishRecordSchema).safeParse(input.responseData);
  if (!parsedRecords.success || parsedRecords.data.length === 0) {
    return { success: true };
  }

  const totalTokens = parsedRecords.data.reduce((sum, item) => sum + (item.tokens || 0), 0);
  const totalPoints = parsedRecords.data.reduce(
    (sum, item) => sum + (item.totalPoints || item.price || 0),
    0
  );
  const responseTimeMs = Math.round(
    parsedRecords.data.reduce((sum, item) => sum + (item.runningTime || 0), 0) * 1000
  );
  const models = [...new Set(parsedRecords.data.map((item) => item.model).filter(Boolean))];

  if (totalTokens > 0) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.tokenUsage.create({
        data: {
          userId: validated.payload.sub,
          clientId: 'fastgpt-share-auth',
          agentId: `fastgpt:${validated.payload.expertKey}`,
          tokensUsed: totalTokens,
          inputTokens: totalTokens,
          startedAt: now,
          endedAt: now,
          modelName: models.join(', ') || undefined,
          requestPath: '/api/fastgpt/share-auth/finish',
          responseTimeMs,
          responseStatus: 200,
          metadata: {
            uid: validated.payload.uid,
            expertKey: validated.payload.expertKey,
            memberId: validated.payload.memberId,
            totalPoints,
            responseDataLength: parsedRecords.data.length,
          },
        },
      });

      await tx.user.update({
        where: { id: validated.payload.sub },
        data: {
          totalTokens: {
            increment: totalTokens,
          },
        },
      });
    });
  }

  console.info('[FastGPT] share finish recorded', {
    uid: validated.payload.uid,
    expertKey: validated.payload.expertKey,
    memberId: validated.payload.memberId,
    totalTokens,
    totalPoints,
    responseItems: parsedRecords.data.length,
  });

  return { success: true };
}
