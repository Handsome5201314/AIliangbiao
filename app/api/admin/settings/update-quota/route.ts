/**
 * 批量更新游客配额 API
 * POST: 将所有游客的配额更新为指定值
 */

import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const body = await request.json();
    const { limit } = body;

    // 验证配额值
    const defaultLimit = parseInt(limit);
    if (isNaN(defaultLimit) || defaultLimit < 0) {
      return NextResponse.json(
        { error: '无效的配额值' },
        { status: 400 }
      );
    }

    // 更新系统配置
    await prisma.systemConfig.upsert({
      where: { configKey: 'defaultDailyLimit' },
      update: { 
        configValue: String(defaultLimit),
        updatedAt: new Date()
      },
      create: {
        configKey: 'defaultDailyLimit',
        configValue: String(defaultLimit),
        description: '游客每日默认限额'
      }
    });

    // 批量更新所有游客的配额
    const result = await prisma.user.updateMany({
      where: { isGuest: true },
      data: { dailyLimit: defaultLimit }
    });

    return NextResponse.json({
      success: true,
      message: `已更新 ${result.count} 个游客账户的配额为 ${defaultLimit}`,
      updatedCount: result.count,
      newLimit: defaultLimit
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    console.error('[Update Quota Error]:', error);
    return NextResponse.json(
      { error: '更新配额失败' },
      { status: 500 }
    );
  }
}
