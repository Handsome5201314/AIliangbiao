/**
 * 评估结果保存API - 将评估结果持久化到数据库
 * 
 * 功能：
 * 1. 检查用户额度
 * 2. 保存评估结果到 AssessmentHistory 表
 * 3. 扣减用户额度
 */

import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import { getScaleDefinitionById } from '@/lib/scales/catalog';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, profileId, scaleId, totalScore, conclusion, answers } = body;

    // 参数验证
    if (!deviceId || !scaleId || totalScore === undefined || !conclusion || !answers) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // ✅ 修复：先获取或创建用户，再检查额度
    // 原因：consumeQuota 需要用户存在才能正确扣除配额
    // 效果：确保流程正确，避免配额扣除失败
    const user = await QuotaManager.getOrCreateGuest(deviceId);

    // 2. 检查并扣除额度（原子操作）
    const canConsume = await QuotaManager.consumeQuota(deviceId);
    if (!canConsume) {
      return NextResponse.json(
        { error: '额度不足，请明天再试或升级账号' },
        { status: 403 }
      );
    }

    // 3. 保存评估结果到数据库
    // ✅ 优化：从 AllScales 注册表获取量表版本号
    const scale = getScaleDefinitionById(scaleId);
    const scaleVersion = scale?.version || '1.0'; // 如果量表定义中有 version 字段则使用，否则默认 1.0
    
    const assessment = await prisma.assessmentHistory.create({
      data: {
        userId: user.id,
        profileId: profileId || null,
        scaleId,
        scaleVersion, // ✅ 新增：保存版本号
        totalScore: parseFloat(totalScore.toFixed(2)),
        conclusion,
        answers: JSON.parse(JSON.stringify(answers)), // 确保是纯对象
      },
    });

    console.log(`[Assessment Saved] User: ${user.id}, Scale: ${scaleId}, Score: ${totalScore}`);

    return NextResponse.json({ 
      success: true, 
      assessment: {
        id: assessment.id,
        scaleId: assessment.scaleId,
        totalScore: assessment.totalScore,
        conclusion: assessment.conclusion,
        createdAt: assessment.createdAt,
      }
    });
  } catch (error) {
    console.error('[Save Assessment Error]:', error);
    return NextResponse.json(
      { error: '保存评估结果失败，请稍后重试' },
      { status: 500 }
    );
  }
}
