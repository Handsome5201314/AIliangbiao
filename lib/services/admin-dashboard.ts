import { prisma } from '@/lib/db/prisma';

import { PROVIDER_CONFIGS } from './apiKeyService';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MCP_ENTRYPOINTS = [
  { key: 'canonical', label: '/api/mcp' },
  { key: 'scale_compat', label: '/api/mcp/scale' },
  { key: 'growth_compat', label: '/api/mcp/growth' },
  { key: 'memory_compat', label: '/api/mcp/memory' },
] as const;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function mapProviderName(provider: string) {
  return PROVIDER_CONFIGS[provider]?.name || provider;
}

export async function getAdminDashboard() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_IN_MS);
  const last24Hours = new Date(now.getTime() - DAY_IN_MS);

  await prisma.$queryRaw`SELECT 1`;

  const [
    totalUsers,
    todayUsers,
    yesterdayUsers,
    totalMembers,
    totalAssessments,
    todayAssessments,
    yesterdayAssessments,
    totalMcpCalls,
    todayMcpCalls,
    yesterdayMcpCalls,
    guestUsers,
    registeredPatients,
    doctorUsers,
    pendingDoctors,
    activeMcpKeyCount,
    aiProviderKeys,
    recentUsers,
    recentAssessments,
    recentMcpLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    prisma.memberProfile.count(),
    prisma.assessmentHistory.count(),
    prisma.assessmentHistory.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.assessmentHistory.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    prisma.mcpLog.count(),
    prisma.mcpLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.mcpLog.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    prisma.user.count({ where: { isGuest: true } }),
    prisma.user.count({ where: { isGuest: false, accountType: 'PATIENT' } }),
    prisma.user.count({ where: { accountType: 'DOCTOR' } }),
    prisma.doctorProfile.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.apiKey.count({
      where: {
        isActive: true,
        userId: null,
        OR: [{ purpose: 'MCP' }, { provider: 'mcp' }],
      },
    }),
    prisma.apiKey.findMany({
      where: {
        purpose: 'AI',
        isActive: true,
        connectionStatus: 'online',
        NOT: { provider: 'mcp' },
      },
      select: { provider: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        isGuest: true,
        accountType: true,
        deviceId: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.assessmentHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        scaleId: true,
        createdAt: true,
        profile: {
          select: {
            nickname: true,
          },
        },
        user: {
          select: {
            deviceId: true,
            email: true,
          },
        },
      },
    }),
    prisma.mcpLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        action: true,
        scaleId: true,
        entrypoint: true,
        createdAt: true,
      },
    }),
  ]);

  const entrypointStatsRaw = await Promise.all(
    MCP_ENTRYPOINTS.map(async (entrypoint) => {
      const [callsLast24h, latestLog] = await Promise.all([
        prisma.mcpLog.count({
          where: {
            entrypoint: entrypoint.key,
            createdAt: { gte: last24Hours },
          },
        }),
        prisma.mcpLog.findFirst({
          where: { entrypoint: entrypoint.key },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      return {
        key: entrypoint.key,
        label: entrypoint.label,
        callsLast24h,
        lastCalledAt: latestLog?.createdAt.toISOString() || null,
      };
    })
  );

  const onlineProviders = Array.from(new Set(aiProviderKeys.map((item) => item.provider))).map((provider) => ({
    id: provider,
    name: mapProviderName(provider),
  }));

  const recentActivities = [
    ...recentUsers.map((user) => ({
      id: `user-${user.id}`,
      type: 'user' as const,
      occurredAt: user.createdAt.toISOString(),
      title: user.accountType === 'DOCTOR'
        ? '新医生账号注册'
        : user.isGuest
          ? '新游客账号创建'
          : '新患者账号注册',
      description: user.email || user.deviceId || user.id,
    })),
    ...recentAssessments.map((assessment) => ({
      id: `assessment-${assessment.id}`,
      type: 'assessment' as const,
      occurredAt: assessment.createdAt.toISOString(),
      title: `${assessment.profile?.nickname || assessment.user.email || assessment.user.deviceId || '用户'} 完成 ${assessment.scaleId} 评估`,
      description: assessment.user.email || assessment.user.deviceId || assessment.scaleId,
    })),
    ...recentMcpLogs.map((log) => ({
      id: `mcp-${log.id}`,
      type: 'mcp' as const,
      occurredAt: log.createdAt.toISOString(),
      title: `MCP 调用 ${log.action}`,
      description: `${entrypointStatsRaw.find((item) => item.key === log.entrypoint)?.label || log.entrypoint}${log.scaleId ? ` · ${log.scaleId}` : ''}`,
    })),
  ]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 10);

  const canonical = entrypointStatsRaw.find((item) => item.key === 'canonical')!;
  const compatibility = entrypointStatsRaw.filter((item) => item.key !== 'canonical');

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalUsers,
      todayUsers,
      totalMembers,
      totalAssessments,
      todayAssessments,
      totalMcpCalls,
      todayMcpCalls,
      onlineAiProviderCount: onlineProviders.length,
      activeMcpKeyCount,
    },
    userBreakdown: {
      guests: guestUsers,
      registeredPatients,
      doctorAccounts: doctorUsers,
      pendingDoctors,
    },
    activityDelta: {
      users: todayUsers - yesterdayUsers,
      assessments: todayAssessments - yesterdayAssessments,
      mcpCalls: todayMcpCalls - yesterdayMcpCalls,
    },
    recentActivities,
    mcpStatus: {
      databaseHealthy: true,
      canonicalAuthEnabled: true,
      canonical,
      compatibility,
      onlineProviders,
    },
  };
}
