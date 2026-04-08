/**
 * 语音转文本工具
 * 
 * 功能：
 * 1. 调用 SiliconFlow/OpenAI 语音识别 API
 * 2. 支持多种音频格式（webm, wav, mp3, m4a）
 * 3. 错误处理和重试机制
 * 4. 超时保护
 */

import { prisma } from '@/lib/db/prisma';

// 支持的音频格式
export type AudioFormat = 'webm' | 'wav' | 'mp3' | 'm4a' | 'ogg';

// 语音识别配置
export interface TranscriptionConfig {
  provider: 'siliconflow' | 'openai' | 'oneapi' | 'custom';
  model?: string;
  language?: string; // 语言代码：zh-CN, en-US
  apiKey?: string;
  endpoint?: string;
  timeout?: number; // 超时时间（毫秒）
}

// 转写结果
export interface TranscriptionResult {
  success: boolean;
  text?: string;
  confidence?: number;
  duration?: number; // 音频时长（秒）
  error?: string;
  provider?: string;
  model?: string;
}

/**
 * 获取可用的语音识别 API Key
 */
export async function getSpeechApiKey(preferredProvider?: string): Promise<{
  apiKey: string;
  provider: string;
  endpoint: string;
  model: string;
} | null> {
  try {
    // ✅ 修复：查询活跃的语音识别服务 API Key（必须指定 serviceType）
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        provider: preferredProvider || 'siliconflow',
        serviceType: 'speech', // ✅ 关键：只查询语音识别服务的 API Key
        isActive: true,
      },
      orderBy: {
        lastUsedAt: 'asc', // 轮询使用
      },
    });

    if (!apiKeyRecord) {
      console.error('[Speech API] No active speech API key found');
      return null;
    }

    // 解密 API Key（实际项目中应该使用加密存储）
    const apiKey = apiKeyRecord.keyValue;

    // 获取端点和模型
    let endpoint = apiKeyRecord.customEndpoint || getDefaultEndpoint(apiKeyRecord.provider);
    let model = apiKeyRecord.customModel || getDefaultModel(apiKeyRecord.provider);

    console.log('[Speech API] Using API key:', {
      provider: apiKeyRecord.provider,
      serviceType: apiKeyRecord.serviceType,
      model,
      endpoint,
    });

    // 更新使用记录
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return {
      apiKey,
      provider: apiKeyRecord.provider,
      endpoint,
      model,
    };
  } catch (error) {
    console.error('[Speech API] Error getting API key:', error);
    return null;
  }
}

/**
 * 获取默认端点
 */
function getDefaultEndpoint(provider: string): string {
  switch (provider) {
    case 'siliconflow':
      return 'https://api.siliconflow.cn/v1/audio/transcriptions';
    case 'openai':
      return 'https://api.openai.com/v1/audio/transcriptions';
    case 'oneapi':
      return '';
    default:
      return '';
  }
}

/**
 * 获取默认模型
 */
function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'siliconflow':
      return 'FunAudioLLM/SenseVoiceSmall'; // SiliconFlow 推荐模型
    case 'openai':
      return 'whisper-1'; // OpenAI Whisper
    case 'oneapi':
      return '';
    default:
      return 'whisper-1';
  }
}

/**
 * 调用语音识别 API（带缓存优化）
 * 
 * @param audioBlob - 音频 Blob 数据
 * @param format - 音频格式
 * @param config - 转写配置
 * @returns 转写结果
 */
export async function transcribeAudio(
  audioBlob: Blob,
  format: AudioFormat = 'webm',
  config?: Partial<TranscriptionConfig>
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const timeout = config?.timeout || 30000; // 默认 30 秒超时
  
  try {
    // 🚀 优化：快速匹配常用短语
    const { quickMatchPhrase, generateAudioHash, getCachedTranscript, setCachedTranscript } = 
      await import('@/lib/cache/speechCache');
    
    // 🚀 优化：尝试从缓存获取
    const audioHash = generateAudioHash(audioBlob);
    const cached = getCachedTranscript(audioHash);
    
    if (cached) {
      console.log('[Speech API] Using cached result');
      return {
        success: true,
        text: cached.transcript,
        confidence: cached.confidence,
        duration: estimateAudioDuration(audioBlob, format),
        provider: 'cache',
        model: 'cached',
      };
    }
    
    // 获取 API Key
    const apiConfig = await getSpeechApiKey(config?.provider);
    
    if (!apiConfig) {
      return {
        success: false,
        error: '未配置语音识别服务，请联系管理员',
      };
    }

    const { apiKey, provider, endpoint, model } = apiConfig;

    console.log(`[Speech API] Transcribing audio`, {
      provider,
      model,
      format,
      audioSize: `${(audioBlob.size / 1024).toFixed(2)} KB`,
      audioHash,
    });

    // 构建 FormData
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${format}`);
    formData.append('model', config?.model || model);
    
    if (config?.language) {
      formData.append('language', config.language);
    }

    // 发送请求（带超时保护）
    const apiStartTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Speech API] Error response:', errorText);
      
      return {
        success: false,
        error: `语音识别失败：${response.status} ${response.statusText}`,
        provider,
        model,
      };
    }

    const result = await response.json();

    // 不同服务商的响应格式可能不同
    const text = result.text || result.transcript || '';
    const confidence = result.confidence || 0.9;
    
    // 🚀 优化：快速匹配常用短语
    const quickMatch = quickMatchPhrase(text);
    const finalText = quickMatch || text;

    // 🚀 优化：保存到缓存
    setCachedTranscript(audioHash, finalText, confidence);

    const totalTime = Date.now() - startTime;
    const apiTime = Date.now() - apiStartTime;
    
    console.log(`[Speech API] Transcription successful`, {
      text: finalText.substring(0, 50) + '...',
      confidence,
      audioSize: `${(audioBlob.size / 1024).toFixed(2)} KB`,
      apiTime: `${apiTime}ms`,
      totalTime: `${totalTime}ms`,
      cached: quickMatch ? 'yes' : 'no',
    });

    return {
      success: true,
      text: finalText,
      confidence,
      duration: estimateAudioDuration(audioBlob, format),
      provider,
      model,
    };
  } catch (error: any) {
    console.error('[Speech API] Transcription error:', error);
    
    // 超时错误
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: '语音识别超时，请重试',
      };
    }
    
    // 网络错误
    if (error.message?.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络设置',
      };
    }
    
    return {
      success: false,
      error: error.message || '语音识别失败，请重试',
    };
  }
}

/**
 * 带重试的语音识别
 * 
 * @param audioBlob - 音频 Blob 数据
 * @param format - 音频格式
 * @param maxRetries - 最大重试次数
 * @returns 转写结果
 */
export async function transcribeWithRetry(
  audioBlob: Blob,
  format: AudioFormat = 'webm',
  maxRetries: number = 3
): Promise<TranscriptionResult> {
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Speech API] Attempt ${attempt}/${maxRetries}`);
    
    const result = await transcribeAudio(audioBlob, format);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error || 'Unknown error';
    
    // 如果是配置错误，不重试
    if (lastError.includes('未配置') || lastError.includes('网络连接失败')) {
      break;
    }
    
    // 等待一段时间再重试
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return {
    success: false,
    error: `语音识别失败（重试 ${maxRetries} 次后）：${lastError}`,
  };
}

/**
 * 检测浏览器支持的音频格式
 * 
 * ⚠️ 注意：此函数只能在浏览器端调用
 * 后端不应调用此函数，应从前端传递音频格式
 */
export function getSupportedAudioFormat(): AudioFormat {
  // 检查是否在浏览器环境
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    console.warn('[getSupportedAudioFormat] 非浏览器环境，返回默认格式 webm');
    return 'webm';
  }

  // 优先使用 webm（压缩率高，体积小）
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'webm';
  }
  
  // 备选：mp4/m4a
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'm4a';
  }
  
  // 备选：ogg
  if (MediaRecorder.isTypeSupported('audio/ogg')) {
    return 'ogg';
  }
  
  // 最后：wav（无损，体积大）
  return 'wav';
}

/**
 * 估算音频时长（基于文件大小和格式）
 * 注意：这只是粗略估算，准确时长需要解析音频文件
 */
export function estimateAudioDuration(blob: Blob, format: AudioFormat): number {
  const sizeInBytes = blob.size;
  
  // 粗略估算（不同格式压缩率不同）
  const bitrates: Record<AudioFormat, number> = {
    webm: 32000,  // 32 kbps
    mp3: 128000,  // 128 kbps
    m4a: 96000,   // 96 kbps
    wav: 256000,  // 256 kbps
    ogg: 64000,   // 64 kbps
  };
  
  const bitrate = bitrates[format] || 64000;
  const durationInSeconds = (sizeInBytes * 8) / bitrate;
  
  return Math.round(durationInSeconds);
}
