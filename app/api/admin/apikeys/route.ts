import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';

// 获取所有API密钥
export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);

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
        keyValue: true,
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

    return NextResponse.json({ keys });
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
    await requireAdminRequest(req);

    const { provider, keyName, keyValue, customEndpoint, customModel, serviceType } = await req.json();

    const key = await prisma.apiKey.create({
      data: {
        purpose: 'AI',
        provider,
        keyName,
        keyValue, // 生产环境应加密存储
        serviceType: serviceType || 'text', // 默认为文本模型
        customEndpoint: customEndpoint || null,
        customModel: customModel || null,
        isActive: true,
        userId: null,  // 系统级密钥
        connectionStatus: 'unknown'
      }
    });

    return NextResponse.json({ success: true, key });
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
    await requireAdminRequest(req);

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
