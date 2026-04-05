/**
 * 用户画像同步API - 将用户画像数据同步到数据库
 * 
 * 功能：
 * 1. 接收前端画像数据
 * 2. 获取或创建用户账号
 * 3. 更新/创建 ChildProfile 记录
 */

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, nickname, gender, ageMonths, interests, fears, avatarConfig } = body;

    // 参数验证
    if (!deviceId || !nickname || !gender) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取或创建用户
    const user = await QuotaManager.getOrCreateGuest(deviceId);

    // 查找是否存在该用户的画像
    let profile = await prisma.childProfile.findFirst({
      where: { userId: user.id },
    });

    if (profile) {
      // 更新现有画像
      profile = await prisma.childProfile.update({
        where: { id: profile.id },
        data: {
          nickname,
          gender,
          ageMonths: ageMonths || null,
          traits: { 
            interests: interests || [], 
            fears: fears || [] 
          },
          avatarConfig: avatarConfig || {},
        },
      });
    } else {
      // 创建新画像
      profile = await prisma.childProfile.create({
        data: {
          userId: user.id,
          nickname,
          gender,
          ageMonths: ageMonths || null,
          traits: { 
            interests: interests || [], 
            fears: fears || [] 
          },
          avatarConfig: avatarConfig || {},
        },
      });
    }

    console.log(`[Profile Synced] User: ${user.id}, Nickname: ${nickname}`);

    return NextResponse.json({ 
      success: true, 
      profile: {
        id: profile.id,
        nickname: profile.nickname,
        gender: profile.gender,
        ageMonths: profile.ageMonths,
        updatedAt: profile.updatedAt,
      }
    });
  } catch (error) {
    console.error('[Sync Profile Error]:', error);
    return NextResponse.json(
      { error: '同步用户画像失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取用户画像
 */
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

    // 获取用户
    const user = await prisma.user.findUnique({
      where: { deviceId },
      include: { profiles: true },
    });

    if (!user || user.profiles.length === 0) {
      return NextResponse.json({ profile: null });
    }

    const profile = user.profiles[0];

    return NextResponse.json({ 
      profile: {
        nickname: profile.nickname,
        gender: profile.gender,
        ageMonths: profile.ageMonths,
        interests: (profile.traits as any)?.interests || [],
        fears: (profile.traits as any)?.fears || [],
        avatarConfig: profile.avatarConfig,
      }
    });
  } catch (error) {
    console.error('[Get Profile Error]:', error);
    return NextResponse.json(
      { error: '获取用户画像失败' },
      { status: 500 }
    );
  }
}
