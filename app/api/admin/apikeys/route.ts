import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { normalizeApiServiceType } from '@/lib/services/apiKeyProviderConfig';
import { BUSINESS_SECRET_VERSION, encryptBusinessSecret, maskBusinessSecret } from '@/lib/utils/businessSecrets';

// 获取所有API密钥
export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });

    const keys = await prisma.apiKey.findMany({
      where: {
        purpose: 'AI',
        NOT: { provider: 'mcp' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        purpose: true,
        provider: true,
        keyName: true,
        secretPreview: true,
        secretVersion: true,
        serviceType: true,
        customEndpoint: true,
        customModel: true,
        isActive: true,
        usageCount: true,
        connectionStatus: true,
        lastTestedAt: true,
        responseTime: true,
        lastUsedAt: true,
        createdAt: true,
        userId: true,
      }
    });

    return NextResponse.json({
      keys: keys.map((key) => ({
        ...key,
        secretConfigured: Boolean(key.secretPreview),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// 添加新API密钥（系统级）
export async function POST(req: NextRequest) {
  try {
    await requireAdminRequest(req, { roles: [ADMIN_ROLE.SUPER_ADMIN] });

    const { provider, keyName, keyValue, customEndpoint, customModel, serviceType } = await req.json();

    const trimmedKey = typeof keyValue === 'string' ? keyValue.trim() : '';
    if (!trimmedKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const key = await prisma.apiKey.create({
      data: {
        purpose: 'AI',
        provider,
        keyName,
        secretCiphertext: encryptBusinessSecret(trimmedKey),
        secretPreview: maskBusinessSecret(trimmedKey),
        secretVersion: BUSINESS_SECRET_VERSION,
        serviceType: normalizeApiServiceType(serviceType), // 默认为文本模型，旧 speech 兼容为 asr
        customEndpoint: customEndpoint || null,
        customModel: customModel || null,
        isActive: true,
        userId: null,  // 系统级密钥
        connectionStatus: 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        purpose: key.purpose,
        provider: key.provider,
        keyName: key.keyName,
        secretPreview: key.secretPreview,
        secretVersion: key.secretVersion,
        serviceType: key.serviceType,
        customEndpoint: key.customEndpoint,
        customModel: key.customModel,
        isActive: key.isActive,
        usageCount: key.usageCount,
        connectionStatus: key.connectionStatus,
        lastTestedAt: key.lastTestedAt,
        responseTime: key.responseTime,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        userId: key.userId,
        secretConfigured: Boolean(key.secretPreview),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    console.error('Failed to add API key:', error);
    return NextResponse.json({ error: 'Failed to add API key' }, { status: 500 });
  }
}

// 删除API密钥
export async function DELETE(req: NextRequest) {
  try {
    await requireAdminRequest(req, { roles: [ADMIN_ROLE.SUPER_ADMIN] });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const key = await prisma.apiKey.findFirst({
      where: {
        id,
        purpose: 'AI',
        NOT: { provider: 'mcp' },
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
