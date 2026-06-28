import { prisma } from '@/lib/db/prisma';
import { hashBusinessSecret } from '@/lib/utils/businessSecrets';

export type McpEntrypoint = 'canonical' | 'scale_compat' | 'growth_compat' | 'memory_compat';
export type McpToolAuditStatus = 'SUCCESS' | 'ERROR';

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
      secretHash: hashBusinessSecret(token),
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

function toJsonValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function summarizeToolArguments(args: unknown) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }

  const record = args as Record<string, unknown>;
  return {
    keys: Object.keys(record).sort(),
    scaleId: typeof record.scaleId === 'string' ? record.scaleId : undefined,
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
    questionId:
      typeof record.questionId === 'string' || typeof record.questionId === 'number'
        ? record.questionId
        : undefined,
    hasAnswers: Array.isArray(record.answers),
  };
}

function summarizeToolResult(result: unknown) {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const record = result as Record<string, unknown>;
  const error = record.error as Record<string, unknown> | undefined;
  if (error && typeof error === 'object') {
    return {
      errorCode: error.code,
      errorMessage:
        typeof error.message === 'string' ? error.message.slice(0, 200) : undefined,
    };
  }

  const payload = record.result as Record<string, unknown> | undefined;
  if (payload && typeof payload === 'object') {
    return {
      isError: payload.isError === true,
      resultKeys: Object.keys(payload).sort(),
    };
  }

  return {
    resultKeys: Object.keys(record).sort(),
  };
}

export async function logMcpToolCall(input: {
  apiKeyId: string;
  userId?: string | null;
  toolName: string;
  requestId?: string | null;
  arguments?: unknown;
  result?: unknown;
  argumentsSummary?: unknown;
  resultSummary?: unknown;
  status: McpToolAuditStatus;
  success: boolean;
  errorCode?: string | null;
  latencyMs?: number | null;
  entrypoint: McpEntrypoint;
}) {
  await prisma.mcpToolLog.create({
    data: {
      apiKeyId: input.apiKeyId,
      userId: input.userId ?? null,
      toolName: input.toolName,
      requestId: input.requestId ?? null,
      argumentsSummary: toJsonValue(input.argumentsSummary ?? summarizeToolArguments(input.arguments)),
      resultSummary: toJsonValue(input.resultSummary ?? summarizeToolResult(input.result)),
      status: input.status,
      success: input.success,
      errorCode: input.errorCode ?? null,
      latencyMs: input.latencyMs ?? null,
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
