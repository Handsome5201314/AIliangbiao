import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { hashBusinessSecret, maskBusinessSecret } from '@/lib/utils/businessSecrets';

const DEFAULT_MCP_KEY_NAME = 'Assessment Core MCP Key';
const MAX_MCP_KEY_NAME_LENGTH = 80;

function normalizeMcpKeyName(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return DEFAULT_MCP_KEY_NAME;
  }
  return trimmed.slice(0, MAX_MCP_KEY_NAME_LENGTH);
}

function createMcpKeyErrorResponse(error: string, message: string, status = 500) {
  return NextResponse.json({ success: false, error, message }, { status });
}

/**
 * 生成API密钥
 */
function generateApiKey(): string {
  return 'sk-' + crypto.randomBytes(32).toString('hex');
}

/**
 * GET - 获取所有API密钥
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const keys = await prisma.apiKey.findMany({
      where: {
        userId: null,
        OR: [{ purpose: 'MCP' }, { provider: 'mcp' }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        purpose: true,
        provider: true,
        keyName: true,
        secretPreview: true,
        isActive: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true
      }
    });

    const maskedKeys = keys.map(key => ({
      ...key,
      secretConfigured: Boolean(key.secretPreview),
    }));

    return NextResponse.json({ keys: maskedKeys });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

/**
 * POST - 创建新的API密钥
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdminRequest(req);

    const { keyName } = await req.json();
    const normalizedKeyName = normalizeMcpKeyName(keyName);

    const keyValue = generateApiKey();

    const key = await prisma.apiKey.create({
      data: {
        purpose: 'MCP',
        provider: 'mcp',  // MCP服务专用
        keyName: normalizedKeyName,
        secretHash: hashBusinessSecret(keyValue),
        secretPreview: maskBusinessSecret(keyValue),
        secretVersion: 'bs:hmac:v1',
        isActive: true,
        userId: null  // 系统级
      }
    });

    return NextResponse.json({ 
      success: true, 
      key: {
        id: key.id,
        keyName: key.keyName,
        keyValue,  // 只在创建时返回完整密钥
        createdAt: key.createdAt
      },
      message: 'API密钥创建成功，请妥善保管'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createMcpKeyErrorResponse('UNAUTHORIZED', '管理员登录已失效，请重新登录', 401);
    }

    if (
      error instanceof Error &&
      error.message.includes('BUSINESS_SECRET_ENCRYPTION_KEY')
    ) {
      console.error('Failed to create API key:', error);
      return createMcpKeyErrorResponse(
        'BUSINESS_SECRET_ENCRYPTION_KEY_MISSING',
        '生产环境缺少 BUSINESS_SECRET_ENCRYPTION_KEY，无法安全创建 MCP 密钥。',
        500
      );
    }

    console.error('Failed to create API key:', error);
    return createMcpKeyErrorResponse(
      'MCP_KEY_CREATE_FAILED',
      '创建 MCP 密钥失败，请检查数据库迁移、生产环境变量和服务器日志。',
      500
    );
  }
}

/**
 * DELETE - 删除API密钥
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdminRequest(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const key = await prisma.apiKey.findFirst({
      where: {
        id,
        OR: [{ purpose: 'MCP' }, { provider: 'mcp' }],
      },
      select: { id: true },
    });

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await prisma.apiKey.delete({ where: { id: key.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    console.error('Failed to delete API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
