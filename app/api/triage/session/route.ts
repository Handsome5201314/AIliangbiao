/**
 * 分诊会话管理 API
 * 
 * 功能：
 * 1. GET：获取用户当前进行中的分诊会话（断点续诊）
 * 2. POST：保存/更新分诊会话状态
 * 3. DELETE：标记会话为已完成
 */

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { NextRequest, NextResponse } from 'next/server';

// 获取当前进行中的分诊会话
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: '缺少 deviceId 参数' }, { status: 400 });
    }

    // 获取或创建用户
    const user = await QuotaManager.getOrCreateGuest(deviceId);

    // 查找进行中的会话（最新的）
    const ongoingSession = await prisma.triageSession.findFirst({
      where: {
        userId: user.id,
        status: {
          in: ['ONGOING', 'CONSENT', 'PAUSED'],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!ongoingSession) {
      return NextResponse.json({ session: null });
    }

    // 检查会话是否过期（超过24小时自动关闭）
    const hoursSinceUpdate = (Date.now() - ongoingSession.updatedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 24) {
      await prisma.triageSession.update({
        where: { id: ongoingSession.id },
        data: { status: 'EXPIRED' },
      });
      
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({
      session: {
        id: ongoingSession.id,
        status: ongoingSession.status,
        symptoms: ongoingSession.symptoms,
        conversationHistory: ongoingSession.conversationHistory,
        recommendedScale: ongoingSession.recommendedScale,
        updatedAt: ongoingSession.updatedAt,
      },
    });

  } catch (error) {
    console.error('[Get Triage Session Error]:', error);
    return NextResponse.json(
      { error: '获取分诊会话失败' },
      { status: 500 }
    );
  }
}

// 保存/更新分诊会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, status, symptoms, conversationHistory, recommendedScale, sessionId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: '缺少 deviceId 参数' }, { status: 400 });
    }

    // 获取或创建用户
    const user = await QuotaManager.getOrCreateGuest(deviceId);

    // 如果提供了 sessionId，更新现有会话
    if (sessionId) {
      const updated = await prisma.triageSession.update({
        where: { id: sessionId },
        data: {
          status: status || undefined,
          symptoms: symptoms || undefined,
          conversationHistory: conversationHistory || undefined,
          recommendedScale: recommendedScale || undefined,
        },
      });

      return NextResponse.json({ success: true, session: updated });
    }

    // 否则创建新会话
    const newSession = await prisma.triageSession.create({
      data: {
        userId: user.id,
        status: status || 'ONGOING',
        symptoms: symptoms || [],
        conversationHistory: conversationHistory || [],
        recommendedScale: recommendedScale || null,
      },
    });

    return NextResponse.json({ success: true, session: newSession });

  } catch (error) {
    console.error('[Save Triage Session Error]:', error);
    return NextResponse.json(
      { error: '保存分诊会话失败' },
      { status: 500 }
    );
  }
}

// 标记会话为已完成
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: '缺少 sessionId 参数' }, { status: 400 });
    }

    await prisma.triageSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Complete Triage Session Error]:', error);
    return NextResponse.json(
      { error: '标记会话失败' },
      { status: 500 }
    );
  }
}
