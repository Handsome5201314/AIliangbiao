import { prisma } from '@/lib/db/prisma';

export const ADMIN_POLICIES_CONFIG_KEY = 'platformGovernancePolicies';

export type AdminPolicies = {
  sensitiveAccess: {
    requireConfirmation: boolean;
    ticketTtlMinutes: number;
    blockOnAuditFailure: boolean;
  };
  knowledgeReview: {
    requireAdminReview: boolean;
    allowOrganizationReviewer: boolean;
    pendingSlaHours: number;
  };
  explanation: {
    knowledgeDefaultMode: 'platform_proxy' | 'direct_fastgpt';
    allowDoctorSupplement: boolean;
    fallbackToStandardExplanation: boolean;
  };
  runtime: {
    hermesDegradeThresholdPercent: number;
    enableDoctorBotFallback: boolean;
    enforceTenantIsolation: boolean;
  };
  catalog: {
    doctorExplorationEnabled: boolean;
  };
  rateLimits: {
    agentSessionPerDevicePerMinute: number;
    questionExplanationPerMinute: number;
    webhookPerChannelPerMinute: number;
  };
};

export const DEFAULT_ADMIN_POLICIES: AdminPolicies = {
  sensitiveAccess: {
    requireConfirmation: true,
    ticketTtlMinutes: 30,
    blockOnAuditFailure: true,
  },
  knowledgeReview: {
    requireAdminReview: true,
    allowOrganizationReviewer: false,
    pendingSlaHours: 24,
  },
  explanation: {
    knowledgeDefaultMode: 'platform_proxy',
    allowDoctorSupplement: true,
    fallbackToStandardExplanation: true,
  },
  runtime: {
    hermesDegradeThresholdPercent: 5,
    enableDoctorBotFallback: true,
    enforceTenantIsolation: true,
  },
  catalog: {
    doctorExplorationEnabled: false,
  },
  rateLimits: {
    agentSessionPerDevicePerMinute: 20,
    questionExplanationPerMinute: 60,
    webhookPerChannelPerMinute: 120,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function normalizePolicies(value: unknown): AdminPolicies {
  const raw = isPlainObject(value) ? value : {};
  const sensitiveAccess = isPlainObject(raw.sensitiveAccess) ? raw.sensitiveAccess : {};
  const knowledgeReview = isPlainObject(raw.knowledgeReview) ? raw.knowledgeReview : {};
  const explanation = isPlainObject(raw.explanation) ? raw.explanation : {};
  const runtime = isPlainObject(raw.runtime) ? raw.runtime : {};
  const catalog = isPlainObject(raw.catalog) ? raw.catalog : {};
  const rateLimits = isPlainObject(raw.rateLimits) ? raw.rateLimits : {};

  return {
    sensitiveAccess: {
      requireConfirmation: toBoolean(
        sensitiveAccess.requireConfirmation,
        DEFAULT_ADMIN_POLICIES.sensitiveAccess.requireConfirmation
      ),
      ticketTtlMinutes: toPositiveInt(
        sensitiveAccess.ticketTtlMinutes,
        DEFAULT_ADMIN_POLICIES.sensitiveAccess.ticketTtlMinutes
      ),
      blockOnAuditFailure: toBoolean(
        sensitiveAccess.blockOnAuditFailure,
        DEFAULT_ADMIN_POLICIES.sensitiveAccess.blockOnAuditFailure
      ),
    },
    knowledgeReview: {
      requireAdminReview: toBoolean(
        knowledgeReview.requireAdminReview,
        DEFAULT_ADMIN_POLICIES.knowledgeReview.requireAdminReview
      ),
      allowOrganizationReviewer: toBoolean(
        knowledgeReview.allowOrganizationReviewer,
        DEFAULT_ADMIN_POLICIES.knowledgeReview.allowOrganizationReviewer
      ),
      pendingSlaHours: toPositiveInt(
        knowledgeReview.pendingSlaHours,
        DEFAULT_ADMIN_POLICIES.knowledgeReview.pendingSlaHours
      ),
    },
    explanation: {
      knowledgeDefaultMode:
        explanation.knowledgeDefaultMode === 'direct_fastgpt' ? 'direct_fastgpt' : 'platform_proxy',
      allowDoctorSupplement: toBoolean(
        explanation.allowDoctorSupplement,
        DEFAULT_ADMIN_POLICIES.explanation.allowDoctorSupplement
      ),
      fallbackToStandardExplanation: toBoolean(
        explanation.fallbackToStandardExplanation,
        DEFAULT_ADMIN_POLICIES.explanation.fallbackToStandardExplanation
      ),
    },
    runtime: {
      hermesDegradeThresholdPercent: toPositiveInt(
        runtime.hermesDegradeThresholdPercent,
        DEFAULT_ADMIN_POLICIES.runtime.hermesDegradeThresholdPercent
      ),
      enableDoctorBotFallback: toBoolean(
        runtime.enableDoctorBotFallback,
        DEFAULT_ADMIN_POLICIES.runtime.enableDoctorBotFallback
      ),
      enforceTenantIsolation: toBoolean(
        runtime.enforceTenantIsolation,
        DEFAULT_ADMIN_POLICIES.runtime.enforceTenantIsolation
      ),
    },
    catalog: {
      doctorExplorationEnabled: toBoolean(
        catalog.doctorExplorationEnabled,
        DEFAULT_ADMIN_POLICIES.catalog.doctorExplorationEnabled
      ),
    },
    rateLimits: {
      agentSessionPerDevicePerMinute: toPositiveInt(
        rateLimits.agentSessionPerDevicePerMinute,
        DEFAULT_ADMIN_POLICIES.rateLimits.agentSessionPerDevicePerMinute
      ),
      questionExplanationPerMinute: toPositiveInt(
        rateLimits.questionExplanationPerMinute,
        DEFAULT_ADMIN_POLICIES.rateLimits.questionExplanationPerMinute
      ),
      webhookPerChannelPerMinute: toPositiveInt(
        rateLimits.webhookPerChannelPerMinute,
        DEFAULT_ADMIN_POLICIES.rateLimits.webhookPerChannelPerMinute
      ),
    },
  };
}

export async function getAdminPolicies() {
  const stored = await prisma.systemConfig.findUnique({
    where: { configKey: ADMIN_POLICIES_CONFIG_KEY },
    select: { configValue: true },
  });

  if (!stored?.configValue) {
    return DEFAULT_ADMIN_POLICIES;
  }

  try {
    return normalizePolicies(JSON.parse(stored.configValue));
  } catch {
    return DEFAULT_ADMIN_POLICIES;
  }
}

export async function saveAdminPolicies(input: AdminPolicies) {
  const normalized = normalizePolicies(input);

  await prisma.systemConfig.upsert({
    where: { configKey: ADMIN_POLICIES_CONFIG_KEY },
    update: {
      configValue: JSON.stringify(normalized),
      updatedAt: new Date(),
    },
    create: {
      configKey: ADMIN_POLICIES_CONFIG_KEY,
      configValue: JSON.stringify(normalized),
      description: '平台治理策略：敏感访问、知识审核、Hermes 降级与统一限流',
    },
  });

  return normalized;
}
