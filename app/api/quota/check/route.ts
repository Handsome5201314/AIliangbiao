/**
 * 额度检查API - 查询用户剩余评估额度
 * 
 * 功能：
 * 1. 根据 deviceId 获取用户剩余额度
 * 2. 支持游客和注册用户不同额度策略
 */

import { QuotaManager } from '@/lib/auth/quotaManager';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: '缺少deviceId参数' },
        { status: 400 }
      );
    }

    // 获取剩余额度
    const remaining = await QuotaManager.getRemainingQuota(deviceId);
    
    // 获取用户信息
    const user = await QuotaManager.getOrCreateGuest(deviceId);

    return NextResponse.json({ 
      remaining,
      dailyLimit: user.dailyLimit,
      dailyUsed: user.dailyUsed,
      isGuest: user.isGuest,
    });
  } catch (error) {
    console.error('[Check Quota Error]:', error);
    return NextResponse.json(
      { error: '查询额度失败' },
      { status: 500 }
    );
  }
}
