/**
 * 语音识别 API
 * 
 * 功能：
 * 1. 接收音频文件
 * 2. 调用语音识别服务
 * 3. 返回转写文本
 * 4. 记录使用情况
 */

import { NextRequest, NextResponse } from 'next/server';
import { transcribeWithRetry, estimateAudioDuration, AudioFormat } from '@/lib/utils/audioToText';
import { checkSpeechQuota, recordSpeechUsage, validateAudioFile } from '@/lib/services/speechService';
import { QuotaManager } from '@/lib/auth/quotaManager';

// 配置 Next.js 支持大文件上传
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // 允许最大 15MB
    },
  },
};

/**
 * 从文件类型推断音频格式
 */
function inferAudioFormat(mimeType: string): AudioFormat {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mp3')) return 'mp3';
  
  // 默认返回 webm
  return 'webm';
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const deviceId = formData.get('deviceId') as string;
    const context = formData.get('context') as string; // triage, questionnaire, command
    const userId = formData.get('userId') as string; // 可选

    // 参数验证
    if (!audioFile) {
      return NextResponse.json(
        { error: '缺少音频文件' },
        { status: 400 }
      );
    }

    if (!deviceId && !userId) {
      return NextResponse.json(
        { error: '缺少用户标识' },
        { status: 400 }
      );
    }

    // 获取或创建用户（如果提供了 deviceId）
    let user = null;
    if (deviceId) {
      user = await QuotaManager.getOrCreateGuest(deviceId);
    }

    // 检查配额
    const quotaCheck = await checkSpeechQuota(userId || user?.id, deviceId);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: quotaCheck.reason || '配额不足',
          remaining: 0,
        },
        { status: 403 }
      );
    }

    // 验证音频文件
    const audioBuffer = await audioFile.arrayBuffer();
    const audioSize = audioBuffer.byteLength;

    const validation = validateAudioFile({
      size: audioSize,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // ✅ 从文件类型推断音频格式（不再调用 MediaRecorder）
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type });
    const format = inferAudioFormat(audioFile.type || 'audio/webm');

    // 估算音频时长
    const estimatedDuration = estimateAudioDuration(audioBlob, format);

    console.log('[Speech API] Processing audio', {
      deviceId,
      userId,
      context,
      audioSize,
      audioType: audioFile.type,
      estimatedDuration,
      format,
    });

    // 调用语音识别服务（带重试）
    const result = await transcribeWithRetry(audioBlob, format, 3);

    // 记录使用情况
    await recordSpeechUsage({
      userId: userId || user?.id,
      audioDuration: estimatedDuration,
      audioSize,
      provider: result.provider || 'unknown',
      model: result.model || 'unknown',
      transcriptText: result.text,
      confidence: result.confidence,
      context,
      success: result.success,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || '语音识别失败',
          success: false,
        },
        { status: 500 }
      );
    }

    // 返回结果
    return NextResponse.json({
      success: true,
      text: result.text,
      confidence: result.confidence,
      duration: estimatedDuration,
      remaining: quotaCheck.remaining - 1, // 扣除本次使用
      provider: result.provider,
      model: result.model,
    });
  } catch (error: any) {
    console.error('[Speech API] Error:', error);
    
    return NextResponse.json(
      {
        error: error.message || '服务器内部错误',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 查询配额和使用统计
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const userId = searchParams.get('userId');

    if (!deviceId && !userId) {
      return NextResponse.json(
        { error: '缺少用户标识' },
        { status: 400 }
      );
    }

    // 检查配额
    const quotaCheck = await checkSpeechQuota(userId || undefined, deviceId || undefined);

    return NextResponse.json({
      remaining: quotaCheck.remaining,
      dailyLimit: 20,
      allowed: quotaCheck.allowed,
      reason: quotaCheck.reason,
    });
  } catch (error: any) {
    console.error('[Speech API] Error:', error);
    
    return NextResponse.json(
      { error: error.message || '查询失败' },
      { status: 500 }
    );
  }
}
