/**
 * 获取 AI 服务商可用模型列表
 * 从官方 API 拉取真实模型列表
 */

import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';

// 各服务商的 API 端点配置
const PROVIDER_ENDPOINTS: Record<string, { base: string; models: string }> = {
  siliconflow: {
    base: 'https://api.siliconflow.cn/v1',
    models: 'https://api.siliconflow.cn/v1/models'
  },
  sophon: {
    base: 'https://api.sophon.cn/v1',
    models: 'https://api.sophon.cn/v1/models'
  },
  deepseek: {
    base: 'https://api.deepseek.com/v1',
    models: 'https://api.deepseek.com/v1/models'
  },
  openai: {
    base: 'https://api.openai.com/v1',
    models: 'https://api.openai.com/v1/models'
  },
  oneapi: {
    base: 'http://104.197.139.51:3000/v1',
    models: 'http://104.197.139.51:3000/v1/models'
  },
  qwen: {
    base: 'https://dashscope.aliyuncs.com/api/v1',
    models: '' // 通义千问可能不支持标准 models 接口
  },
  custom: {
    base: '',
    models: ''
  }
};

// 备用默认模型列表（仅在 API 获取失败时使用）
const FALLBACK_MODELS: Record<string, Array<{ id: string; name: string; description: string }>> = {
  siliconflow: [
    { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B-Instruct', description: '推荐，性价比高' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B-Instruct', description: '更强大' },
    { id: 'deepseek-ai/DeepSeek-V2.5', name: 'DeepSeek-V2.5', description: 'DeepSeek' },
    { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B-Chat', description: '智谱AI' }
  ],
  sophon: [
    { id: 'sophon-chat', name: 'Sophon Chat', description: '标准对话模型' }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '标准对话模型' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码专用' }
  ],
  qwen: [
    { id: 'qwen-turbo', name: '通义千问 Turbo', description: '快速响应' },
    { id: 'qwen-plus', name: '通义千问 Plus', description: '更强大' },
    { id: 'qwen-max', name: '通义千问 Max', description: '最强' }
  ],
  openai: [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '快速经济' },
    { id: 'gpt-4', name: 'GPT-4', description: '更强大' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '最新' }
  ],
  oneapi: [
    { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash', description: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-exp', name: 'gemini-2.0-flash-exp', description: 'Gemini 2.0 实验版' },
    { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'gemini-2.0-flash-lite-preview-02-05', description: 'Gemini 2.0 Lite Preview' },
    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'gemini-2.0-flash-thinking-exp-01-21', description: 'Gemini 2.0 Thinking Experimental' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'gemini-2.0-pro-exp-02-05', description: 'Gemini 2.0 Pro Experimental' },
    { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', description: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', description: 'Gemini 3 Pro' },
    { id: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', description: 'Gemini 3 Pro Image Preview' },
    { id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro-preview', description: 'Gemini 3.1 Pro Preview' }
  ],
  custom: []
};

// 语音识别模型列表（根据 SiliconFlow 官方文档更新）
// 参考：https://docs.siliconflow.cn/cn/api-reference/audio/create-audio-transcriptions
const SPEECH_MODELS: Record<string, Array<{ id: string; name: string; description: string }>> = {
  siliconflow: [
    { id: 'FunAudioLLM/SenseVoiceSmall', name: 'SenseVoice Small', description: '推荐，中文语音识别，准确率高' },
    { id: 'TeleAI/TeleSpeechASR', name: 'TeleSpeech ASR', description: '电信语音识别' }
  ],
  openai: [
    { id: 'whisper-1', name: 'Whisper V1', description: 'OpenAI 语音识别' }
  ],
  custom: []
};

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const body = await request.json();
    const { provider, endpoint, apiKey, serviceType } = body;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: '请先填写 API Key'
      }, { status: 400 });
    }

    // 如果是语音识别服务，直接返回语音模型列表
    if (serviceType === 'speech') {
      const speechModels = SPEECH_MODELS[provider] || SPEECH_MODELS.custom;
      
      console.log(`[Get Models] Returning ${speechModels.length} speech models for ${provider}`);
      
      return NextResponse.json({
        success: true,
        models: speechModels,
        source: 'speech_models',
        message: '语音识别模型列表'
      });
    }

    // 文本模型：从 API 获取模型列表
    // 确定 models 接口地址
    let modelsEndpoint = '';
    
    if ((provider === 'custom' || provider === 'oneapi') && endpoint) {
      // 自定义接口：从 chat/completions 推断 models 接口
      if (endpoint.endsWith('/models')) {
        modelsEndpoint = endpoint;
      } else if (endpoint.endsWith('/v1')) {
        modelsEndpoint = `${endpoint}/models`;
      } else {
        modelsEndpoint = endpoint.replace('/chat/completions', '/models');
      }
    } else if (PROVIDER_ENDPOINTS[provider]) {
      // 标准服务商：使用预设的 models 接口
      modelsEndpoint = PROVIDER_ENDPOINTS[provider].models;
    }

    // 如果有 models 接口，尝试获取模型列表
    if (modelsEndpoint) {
      try {
        console.log(`[Get Models] Fetching from ${provider}: ${modelsEndpoint}`);
        
        const response = await fetch(modelsEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          signal: AbortSignal.timeout(10000) // 10秒超时
        });

        if (response.ok) {
          const data = await response.json();
          
          // OpenAI 格式的模型列表
          if (data.data && Array.isArray(data.data)) {
            // 过滤出聊天模型，并按名称排序
            const chatModels = data.data
              .filter((model: any) => {
                const id = model.id.toLowerCase();
                // 过滤掉 embedding、audio、image 等非聊天模型
                return !id.includes('embedding') && 
                       !id.includes('audio') && 
                       !id.includes('whisper') &&
                       !id.includes('dall-e') &&
                       !id.includes('tts') &&
                       !id.includes('moderation');
              })
              .sort((a: any, b: any) => a.id.localeCompare(b.id))
              .map((model: any) => ({
                id: model.id,
                name: model.id,
                description: getModelDescription(model.id, provider)
              }));

            console.log(`[Get Models] Successfully fetched ${chatModels.length} models from ${provider}`);
            
            return NextResponse.json({ 
              success: true, 
              models: chatModels,
              source: 'api' // 标记来源为 API
            });
          }
        } else {
          console.error(`[Get Models] API error: ${response.status}`);
        }
      } catch (error: any) {
        console.error(`[Get Models] Failed to fetch from ${provider}:`, error.message);
      }
    }

    // 如果 API 获取失败，返回备用默认列表
    const fallbackModels = FALLBACK_MODELS[provider] || [];
    
    console.log(`[Get Models] Using fallback models for ${provider}`);
    
    return NextResponse.json({
      success: true,
      models: fallbackModels,
      source: 'fallback', // 标记来源为备用
      message: modelsEndpoint ? '无法从官方API获取模型列表，显示备用列表' : '该服务商暂不支持自动获取模型列表'
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    console.error('[Get Models Error]:', error);
    return NextResponse.json(
      { error: '获取模型列表失败' },
      { status: 500 }
    );
  }
}

// 根据模型 ID 生成描述
function getModelDescription(modelId: string, provider: string): string {
  const id = modelId.toLowerCase();
  
  // 硅基流动模型
  if (provider === 'siliconflow') {
    if (id.includes('qwen2.5-7b')) return '推荐，性价比高';
    if (id.includes('qwen2.5-72b')) return '更强大';
    if (id.includes('deepseek')) return 'DeepSeek模型';
    if (id.includes('glm')) return '智谱AI模型';
    if (id.includes('qwen')) return '通义千问';
    if (id.includes('llama')) return 'LLaMA模型';
  }
  
  // DeepSeek 模型
  if (provider === 'deepseek') {
    if (id.includes('coder')) return '代码专用';
    return '对话模型';
  }
  
  // OpenAI 模型
  if (provider === 'openai') {
    if (id.includes('gpt-4-turbo')) return '最新最强';
    if (id.includes('gpt-4')) return '更强大';
    if (id.includes('gpt-3.5')) return '快速经济';
  }

  if (provider === 'oneapi') {
    if (id.includes('gemini-3-pro-image-preview')) return '图片生成/多模态预览';
    if (id.includes('gemini-3.1')) return 'Gemini 3.1 Pro';
    if (id.includes('gemini-3-pro')) return 'Gemini 3 Pro';
    if (id.includes('gemini-3-flash')) return 'Gemini 3 Flash';
    if (id.includes('thinking')) return 'Gemini Thinking Experimental';
    if (id.includes('flash-lite')) return 'Gemini Flash Lite';
    if (id.includes('gemini-2.0-pro')) return 'Gemini 2.0 Pro 实验版';
    if (id.includes('gemini-2.0-flash')) return 'Gemini 2.0 Flash';
  }
  
  // 通义千问模型
  if (provider === 'qwen') {
    if (id.includes('max')) return '最强';
    if (id.includes('plus')) return '更强大';
    if (id.includes('turbo')) return '快速';
  }
  
  return '可用模型';
}
