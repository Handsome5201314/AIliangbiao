/**
 * 语音识别服务管理
 * 
 * 功能：
 * 1. 语音识别配额管理
 * 2. 使用记录统计
 * 3. 成本控制
 */

import { prisma } from '@/lib/db/prisma';

// 语音识别配额配置
export const SPEECH_CONFIG = {
  // 每日配额（每个用户）
  dailyLimit: 20,
  
  // 单次最大音频时长（秒）
  maxAudioDuration: 60,
  
  // 单次最大音频大小（字节）
  maxAudioSize: 10 * 1024 * 1024, // 10MB
  
  // 成本估算（基于 SiliconFlow）
  costPerSecond: 0.00417, // ¥0.00417/秒
} as const;

/**
 * 检查用户语音识别配额
 */
export async function checkSpeechQuota(userId?: string, deviceId?: string): Promise<{
  allowed: boolean;
  remaining: number;
  reason?: string;
}> {
  try {
    // 获取用户标识
    const identifier = userId || deviceId;
    
    if (!identifier) {
      return {
        allowed: false,
        remaining: 0,
        reason: '缺少用户标识',
      };
    }
    
    // 查询今日使用次数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usageCount = await prisma.speechUsage.count({
      where: {
        OR: [
          { userId: userId || undefined },
          // { deviceId: deviceId || undefined }, // 如果需要支持 deviceId，需要先添加字段
        ],
        createdAt: {
          gte: today,
        },
        success: true,
      },
    });
    
    const remaining = Math.max(0, SPEECH_CONFIG.dailyLimit - usageCount);
    
    return {
      allowed: usageCount < SPEECH_CONFIG.dailyLimit,
      remaining,
      reason: usageCount >= SPEECH_CONFIG.dailyLimit 
        ? `今日语音识别次数已达上限（${SPEECH_CONFIG.dailyLimit}次）` 
        : undefined,
    };
  } catch (error) {
    console.error('[Speech Service] Error checking quota:', error);
    return {
      allowed: false,
      remaining: 0,
      reason: '配额检查失败',
    };
  }
}

/**
 * 记录语音识别使用情况
 */
export async function recordSpeechUsage(data: {
  userId?: string;
  audioDuration?: number;
  audioSize?: number;
  provider: string;
  model: string;
  transcriptText?: string;
  confidence?: number;
  context?: string;
  success: boolean;
}): Promise<void> {
  try {
    // 估算成本
    const costTokens = data.audioDuration 
      ? Math.round(data.audioDuration * SPEECH_CONFIG.costPerSecond * 1000) // 转换为毫单位
      : 0;
    
    await prisma.speechUsage.create({
      data: {
        userId: data.userId,
        audioDuration: data.audioDuration,
        audioSize: data.audioSize,
        provider: data.provider,
        model: data.model,
        transcriptText: data.transcriptText,
        confidence: data.confidence,
        context: data.context,
        success: data.success,
        costTokens,
      },
    });
    
    console.log('[Speech Service] Usage recorded', {
      userId: data.userId,
      provider: data.provider,
      success: data.success,
      costTokens,
    });
  } catch (error) {
    console.error('[Speech Service] Error recording usage:', error);
  }
}

/**
 * 获取语音识别使用统计
 */
export async function getSpeechStats(userId?: string, days: number = 7): Promise<{
  totalUsage: number;
  successRate: number;
  avgConfidence: number;
  totalCost: number;
  dailyStats: Array<{
    date: string;
    count: number;
    successCount: number;
    avgConfidence: number;
  }>;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const whereClause: any = {
      createdAt: {
        gte: startDate,
      },
    };
    
    if (userId) {
      whereClause.userId = userId;
    }
    
    // 查询使用记录
    const usages = await prisma.speechUsage.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        success: true,
        confidence: true,
        costTokens: true,
      },
    });
    
    // 计算统计数据
    const totalUsage = usages.length;
    const successCount = usages.filter(u => u.success).length;
    const successRate = totalUsage > 0 ? successCount / totalUsage : 0;
    const avgConfidence = usages.reduce((sum, u) => sum + (u.confidence || 0), 0) / (totalUsage || 1);
    const totalCost = usages.reduce((sum, u) => sum + (u.costTokens || 0), 0) / 1000;
    
    // 按日期分组统计
    const dailyMap = new Map<string, {
      count: number;
      successCount: number;
      totalConfidence: number;
    }>();
    
    usages.forEach(usage => {
      const dateKey = usage.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || {
        count: 0,
        successCount: 0,
        totalConfidence: 0,
      };
      
      existing.count++;
      if (usage.success) existing.successCount++;
      existing.totalConfidence += usage.confidence || 0;
      
      dailyMap.set(dateKey, existing);
    });
    
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        count: stats.count,
        successCount: stats.successCount,
        avgConfidence: stats.totalConfidence / stats.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalUsage,
      successRate,
      avgConfidence,
      totalCost,
      dailyStats,
    };
  } catch (error) {
    console.error('[Speech Service] Error getting stats:', error);
    return {
      totalUsage: 0,
      successRate: 0,
      avgConfidence: 0,
      totalCost: 0,
      dailyStats: [],
    };
  }
}

/**
 * 验证音频文件
 */
export function validateAudioFile(file: {
  size: number;
  duration?: number;
}): {
  valid: boolean;
  error?: string;
} {
  // 检查文件大小
  if (file.size > SPEECH_CONFIG.maxAudioSize) {
    return {
      valid: false,
      error: `音频文件过大（最大 ${SPEECH_CONFIG.maxAudioSize / 1024 / 1024}MB）`,
    };
  }
  
  // 检查音频时长
  if (file.duration && file.duration > SPEECH_CONFIG.maxAudioDuration) {
    return {
      valid: false,
      error: `音频时长过长（最长 ${SPEECH_CONFIG.maxAudioDuration}秒）`,
    };
  }
  
  return { valid: true };
}

/**
 * 估算语音识别成本
 */
export function estimateCost(durationInSeconds: number): number {
  return durationInSeconds * SPEECH_CONFIG.costPerSecond;
}

/**
 * 获取系统语音识别配置
 */
export async function getSpeechSystemConfig(): Promise<{
  dailyLimit: number;
  maxAudioDuration: number;
  maxAudioSize: number;
}> {
  try {
    // 尝试从系统配置读取
    const configRecord = await prisma.systemConfig.findUnique({
      where: { configKey: 'speechConfig' },
    });
    
    if (configRecord) {
      const config = JSON.parse(configRecord.configValue);
      return {
        dailyLimit: config.dailyLimit || SPEECH_CONFIG.dailyLimit,
        maxAudioDuration: config.maxAudioDuration || SPEECH_CONFIG.maxAudioDuration,
        maxAudioSize: config.maxAudioSize || SPEECH_CONFIG.maxAudioSize,
      };
    }
    
    // 返回默认配置
    return {
      dailyLimit: SPEECH_CONFIG.dailyLimit,
      maxAudioDuration: SPEECH_CONFIG.maxAudioDuration,
      maxAudioSize: SPEECH_CONFIG.maxAudioSize,
    };
  } catch (error) {
    console.error('[Speech Service] Error getting system config:', error);
    return {
      dailyLimit: SPEECH_CONFIG.dailyLimit,
      maxAudioDuration: SPEECH_CONFIG.maxAudioDuration,
      maxAudioSize: SPEECH_CONFIG.maxAudioSize,
    };
  }
}
