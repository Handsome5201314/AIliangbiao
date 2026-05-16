import { prisma } from '@/lib/db/prisma';
import type { AgentSessionPayload } from '@/lib/assessment-skill/auth';
import { getAgentWorkspaceConfig } from '@/lib/agent/config';

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function createQuotaExceededError(summary: Awaited<ReturnType<typeof getAgentQuotaSummary>>) {
  const error = new Error('今日通过智能体启动量表的次数已达上限，请登录或明天再试。');
  (error as Error & { statusCode?: number; code?: string; data?: unknown }).statusCode = 403;
  (error as Error & { statusCode?: number; code?: string; data?: unknown }).code = 'AGENT_QUOTA_EXCEEDED';
  (error as Error & { statusCode?: number; code?: string; data?: unknown }).data = summary;
  return error;
}

export async function getAgentDailyLimitForSession(session: AgentSessionPayload) {
  const config = await getAgentWorkspaceConfig();

  if (session.role === 'VIP') {
    return Number(config.quota.vipAgentDailyLimit || 999);
  }

  if (session.role === 'GUEST') {
    return Number(config.quota.guestAgentDailyLimit || 5);
  }

  return Number(config.quota.registeredAgentDailyLimit || 20);
}

export async function getAgentUsageForToday(session: AgentSessionPayload) {
  return prisma.assessmentSession.count({
    where: {
      userId: session.sub,
      channel: 'agent',
      createdAt: { gte: startOfToday() },
    },
  });
}

export async function getAgentQuotaSummary(session: AgentSessionPayload) {
  if (session.entrypoint !== 'agent') {
    return {
      scope: 'app' as const,
      unlimited: true,
      remaining: null as number | null,
      dailyLimit: null as number | null,
      dailyUsed: null as number | null,
      warnAtRemaining: null as number | null,
    };
  }

  const config = await getAgentWorkspaceConfig();
  const [dailyLimit, dailyUsed] = await Promise.all([
    getAgentDailyLimitForSession(session),
    getAgentUsageForToday(session),
  ]);

  return {
    scope: 'agent' as const,
    unlimited: false,
    remaining: Math.max(0, dailyLimit - dailyUsed),
    dailyLimit,
    dailyUsed,
    warnAtRemaining: Number(config.quota.warnAtRemaining || 1),
  };
}

export async function assertAgentCanStartAssessment(session: AgentSessionPayload) {
  const summary = await getAgentQuotaSummary(session);
  if (summary.unlimited) {
    return summary;
  }

  if ((summary.remaining || 0) <= 0) {
    throw createQuotaExceededError(summary);
  }

  return summary;
}
