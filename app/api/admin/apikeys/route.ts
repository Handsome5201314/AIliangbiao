import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// 获取所有API密钥
export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
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
        userId: true
      }
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// 添加新API密钥（系统级）
export async function POST(req: NextRequest) {
  try {
    const { provider, keyName, keyValue, customEndpoint, customModel, serviceType } = await req.json();

    const key = await prisma.apiKey.create({
      data: {
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
    console.error('Failed to add API key:', error);
    return NextResponse.json({ error: 'Failed to add API key' }, { status: 500 });
  }
}

// 删除API密钥
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.apiKey.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
