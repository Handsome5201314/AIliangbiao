import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';

/**
 * 生成API密钥
 */
function generateApiKey(): string {
  return 'sk-' + crypto.randomBytes(32).toString('hex');
}

/**
 * GET - 获取所有API密钥
 */
export async function GET() {
  try {
    const keys = await prisma.apiKey.findMany({
      where: {
        userId: null  // 系统级密钥
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        keyName: true,
        keyValue: true,
        isActive: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true
      }
    });

    // 脱敏显示
    const maskedKeys = keys.map(key => ({
      ...key,
      keyValue: key.keyValue.substring(0, 10) + '...' + key.keyValue.substring(key.keyValue.length - 4)
    }));

    return NextResponse.json({ keys: maskedKeys });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

/**
 * POST - 创建新的API密钥
 */
export async function POST(req: NextRequest) {
  try {
    const { keyName, description } = await req.json();

    const keyValue = generateApiKey();

    const key = await prisma.apiKey.create({
      data: {
        provider: 'mcp',  // MCP服务专用
        keyName: keyName || 'MCP API Key',
        keyValue,
        isActive: true,
        userId: null  // 系统级
      }
    });

    return NextResponse.json({ 
      success: true, 
      key: {
        id: key.id,
        keyName: key.keyName,
        keyValue: key.keyValue,  // 只在创建时返回完整密钥
        createdAt: key.createdAt
      },
      message: 'API密钥创建成功，请妥善保管'
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

/**
 * DELETE - 删除API密钥
 */
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
