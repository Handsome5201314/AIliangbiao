import { prisma } from '@/lib/db/prisma';

const ENTRYPOINT_LABELS: Record<string, string> = {
  canonical: '/api/mcp',
  scale_compat: '/api/mcp/scale',
  memory_compat: '/api/mcp/memory',
  legacy: 'legacy',
};

function subtractTime(now: Date, minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function resolveTimeRangeStart(timeRange?: string | null) {
  const now = new Date();

  switch (timeRange) {
    case '5m':
      return subtractTime(now, 5);
    case '1h':
      return subtractTime(now, 60);
    case '24h':
      return subtractTime(now, 24 * 60);
    case '7d':
      return subtractTime(now, 7 * 24 * 60);
    default:
      return null;
  }
}

async function getApiKeyMap(clientIds: string[]) {
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));
  if (!uniqueClientIds.length) {
    return new Map<string, { keyName: string; provider: string }>();
  }

  const keys = await prisma.apiKey.findMany({
    where: {
      id: { in: uniqueClientIds },
    },
    select: {
      id: true,
      keyName: true,
      provider: true,
    },
  });

  return new Map(
    keys.map((key) => [
      key.id,
      {
        keyName: key.keyName,
        provider: key.provider,
      },
    ])
  );
}

function mapLogItem(
  item: {
    id: string;
    clientId: string;
    action: string;
    scaleId: string | null;
    entrypoint: string;
    createdAt: Date;
  },
  apiKeyMap: Map<string, { keyName: string; provider: string }>
) {
  const apiKey = apiKeyMap.get(item.clientId);

  return {
    id: item.id,
    clientId: item.clientId,
    apiKeyName: apiKey?.keyName || null,
    apiKeyProvider: apiKey?.provider || null,
    action: item.action,
    scaleId: item.scaleId,
    entrypoint: item.entrypoint,
    entrypointLabel: ENTRYPOINT_LABELS[item.entrypoint] || item.entrypoint,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function getAdminMcpSummary() {
  const now = new Date();
  const [calls5m, calls1h, calls24h, latestLog, groupedActions, groupedScales, groupedEntrypoints, recentLogs] =
    await Promise.all([
      prisma.mcpLog.count({ where: { createdAt: { gte: subtractTime(now, 5) } } }),
      prisma.mcpLog.count({ where: { createdAt: { gte: subtractTime(now, 60) } } }),
      prisma.mcpLog.count({ where: { createdAt: { gte: subtractTime(now, 24 * 60) } } }),
      prisma.mcpLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.mcpLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 6,
      }),
      prisma.mcpLog.groupBy({
        by: ['scaleId'],
        _count: { scaleId: true },
        orderBy: {
          _count: {
            scaleId: 'desc',
          },
        },
        take: 6,
      }),
      prisma.mcpLog.groupBy({
        by: ['entrypoint'],
        _count: { entrypoint: true },
        orderBy: {
          _count: {
            entrypoint: 'desc',
          },
        },
        take: 6,
      }),
      prisma.mcpLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          clientId: true,
          action: true,
          scaleId: true,
          entrypoint: true,
          createdAt: true,
        },
      }),
    ]);

  const apiKeyMap = await getApiKeyMap(recentLogs.map((item) => item.clientId));

  return {
    generatedAt: now.toISOString(),
    windows: {
      last5m: calls5m,
      last1h: calls1h,
      last24h: calls24h,
    },
    latestCalledAt: latestLog?.createdAt?.toISOString() || null,
    topActions: groupedActions.map((item) => ({
      name: item.action,
      count: item._count.action,
    })),
    topScales: groupedScales
      .filter((item) => item.scaleId)
      .map((item) => ({
        name: item.scaleId as string,
        count: item._count.scaleId,
      })),
    topEntrypoints: groupedEntrypoints.map((item) => ({
      key: item.entrypoint,
      label: ENTRYPOINT_LABELS[item.entrypoint] || item.entrypoint,
      count: item._count.entrypoint,
    })),
    recentCalls: recentLogs.map((item) => mapLogItem(item, apiKeyMap)),
  };
}

export async function getAdminMcpLogs(input: {
  entrypoint?: string | null;
  action?: string | null;
  scaleId?: string | null;
  clientId?: string | null;
  timeRange?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(input.pageSize || 20)));
  const timeRangeStart = resolveTimeRangeStart(input.timeRange);

  const where = {
    ...(input.entrypoint && input.entrypoint !== 'all' ? { entrypoint: input.entrypoint } : {}),
    ...(input.action
      ? {
          action: {
            contains: input.action,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(input.scaleId
      ? {
          scaleId: {
            contains: input.scaleId,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(input.clientId
      ? {
          clientId: {
            contains: input.clientId,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(timeRangeStart
      ? {
          createdAt: {
            gte: timeRangeStart,
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.mcpLog.count({ where }),
    prisma.mcpLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        clientId: true,
        action: true,
        scaleId: true,
        entrypoint: true,
        createdAt: true,
      },
    }),
  ]);

  const apiKeyMap = await getApiKeyMap(items.map((item) => item.clientId));

  return {
    items: items.map((item) => mapLogItem(item, apiKeyMap)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function getMcpEntrypointOptions() {
  return Object.entries(ENTRYPOINT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}
