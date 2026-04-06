import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * 设置系统默认API Key
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证密钥存在
    const key = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!key) {
      return NextResponse.json({ error: 'API密钥不存在' }, { status: 404 });
    }

    // 将该密钥设为系统级（userId设为null）
    await prisma.apiKey.update({
      where: { id },
      data: { userId: null }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set system default:', error);
    return NextResponse.json({ error: '设置失败' }, { status: 500 });
  }
}
