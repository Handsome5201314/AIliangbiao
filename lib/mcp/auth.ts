import { prisma } from '@/lib/db/prisma';

export type McpEntrypoint = 'canonical' | 'scale_compat' | 'growth_compat' | 'memory_compat';

export interface McpApiKeyRecord {
  id: string;
  userId: string | null;
  provider: string;
  keyName: string;
}

export function extractBearerToken(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.length >= 10 ? token : null;
}

export async function validateMcpApiKey(authHeader: string | null): Promise<McpApiKeyRecord | null> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }

  return prisma.apiKey.findFirst({
    where: {
      keyValue: token,
      isActive: true,
      OR: [{ purpose: 'MCP' }, { provider: 'mcp' }],
    },
    select: {
      id: true,
      userId: true,
      provider: true,
      keyName: true,
    },
  });
}

export async function touchMcpApiKey(keyId: string, incrementUsage = false) {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      lastUsedAt: new Date(),
      ...(incrementUsage ? { usageCount: { increment: 1 } } : {}),
    },
  });
}

export async function logMcpToolCall(input: {
  apiKeyId: string;
  userId?: string | null;
  action: string;
  scaleId?: string | null;
  entrypoint: McpEntrypoint;
}) {
  await prisma.mcpLog.create({
    data: {
      userId: input.userId ?? null,
      clientId: input.apiKeyId,
      action: input.action,
      scaleId: input.scaleId ?? null,
      entrypoint: input.entrypoint,
    },
  });
}

export function createJsonRpcAuthError(id: string | number | null, message = 'Invalid MCP API key') {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32001,
      message,
    },
  };
}
