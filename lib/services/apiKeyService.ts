import { prisma } from '@/lib/db/prisma';

export type ApiServiceType = 'text' | 'speech';

type ProviderDefaultConfig = {
  textEndpoint: string;
  textModel: string;
  speechEndpoint: string;
  speechModel: string;
  name: string;
};

export const PROVIDER_CONFIGS: Record<string, ProviderDefaultConfig> = {
  siliconflow: {
    textEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    textModel: 'Qwen/Qwen2.5-7B-Instruct',
    speechEndpoint: 'https://api.siliconflow.cn/v1/audio/transcriptions',
    speechModel: 'FunAudioLLM/SenseVoiceSmall',
    name: '硅基流动',
  },
  sophon: {
    textEndpoint: 'https://api.sophon.cn/v1/chat/completions',
    textModel: 'sophon-chat',
    speechEndpoint: '',
    speechModel: '',
    name: '算能',
  },
  deepseek: {
    textEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    textModel: 'deepseek-chat',
    speechEndpoint: '',
    speechModel: '',
    name: 'DeepSeek',
  },
  qwen: {
    textEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    textModel: 'qwen-turbo',
    speechEndpoint: '',
    speechModel: '',
    name: '通义千问',
  },
  openai: {
    textEndpoint: 'https://api.openai.com/v1/chat/completions',
    textModel: 'gpt-3.5-turbo',
    speechEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    speechModel: 'whisper-1',
    name: 'OpenAI',
  },
  oneapi: {
    textEndpoint: 'http://104.197.139.51:3000/v1/chat/completions',
    textModel: 'gemini-3-flash-preview',
    speechEndpoint: '',
    speechModel: '',
    name: 'OneAPI',
  },
  custom: {
    textEndpoint: '',
    textModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: '自定义',
  },
};

export async function getSystemApiKey() {
  return getSystemApiKeyByService('text');
}

export async function getSystemApiKeyByService(serviceType: ApiServiceType): Promise<{
  key: string;
  provider: string;
  endpoint: string;
  model: string;
}> {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        purpose: 'AI',
        isActive: true,
        userId: null,
        serviceType,
        NOT: { provider: 'mcp' },
      },
      select: {
        id: true,
        provider: true,
        keyValue: true,
        usageCount: true,
        customEndpoint: true,
        customModel: true,
        connectionStatus: true,
      },
      orderBy: [
        { connectionStatus: 'asc' },
        { usageCount: 'asc' },
      ],
    });

    if (apiKeys.length === 0) {
      throw new Error(`系统暂未配置 ${serviceType} 类型的 API 密钥，请联系管理员`);
    }

    const onlineKey = apiKeys.find((item) => item.connectionStatus === 'online');
    const selectedKey = onlineKey || apiKeys[0];
    const providerConfig = PROVIDER_CONFIGS[selectedKey.provider] || PROVIDER_CONFIGS.custom;
    const endpoint =
      selectedKey.customEndpoint ||
      (serviceType === 'speech' ? providerConfig.speechEndpoint : providerConfig.textEndpoint);
    const model =
      selectedKey.customModel ||
      (serviceType === 'speech' ? providerConfig.speechModel : providerConfig.textModel);

    if (!endpoint) {
      throw new Error(`服务商 ${selectedKey.provider} 的接口地址未配置`);
    }

    await prisma.apiKey.update({
      where: { id: selectedKey.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return {
      key: selectedKey.keyValue,
      provider: selectedKey.provider,
      endpoint,
      model,
    };
  } catch (error) {
    console.error(`Failed to get system API key for ${serviceType}:`, error);
    throw error;
  }
}
