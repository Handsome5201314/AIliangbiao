import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { hashBusinessSecret, maskBusinessSecret } from '@/lib/utils/businessSecrets';

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

    const keyValue = generateApiKey();

    const key = await prisma.apiKey.create({
      data: {
        purpose: 'MCP',
        provider: 'mcp',  // MCP服务专用
        keyName: keyName || 'MCP API Key',
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
      return createAdminUnauthorizedResponse();
    }

    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
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
