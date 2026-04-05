/**
 * 系统API密钥服务
 * 用于获取和管理系统级别的AI服务API密钥
 */

import { prisma } from '@/lib/db/prisma';

// 支持的AI服务商配置
export const PROVIDER_CONFIGS: Record<string, { endpoint: string; model: string; name: string }> = {
  siliconflow: {
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    name: '硅基流动'
  },
  sophon: {
    endpoint: 'https://api.sophon.cn/v1/chat/completions',
    model: 'sophon-chat',
    name: '算能'
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    name: 'DeepSeek'
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-turbo',
    name: '通义千问'
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    name: 'OpenAI'
  },
  custom: {
    endpoint: '',  // 用户自定义
    model: '',     // 用户自定义
    name: '自定义'
  }
};

/**
 * 获取系统配置的活跃API Key
 * 返回一个可用的API密钥和服务商配置
 */
export async function getSystemApiKey(): Promise<{
  key: string;
  provider: string;
  endpoint: string;
  model: string;
}> {
  try {
    // 获取所有活跃的系统级API密钥，优先选择在线的
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        isActive: true,
        userId: null  // 系统级密钥
      },
      select: {
        id: true,
        provider: true,
        keyValue: true,
        usageCount: true,
        customEndpoint: true,
        customModel: true,
        connectionStatus: true
      },
      orderBy: [
        { connectionStatus: 'asc' },  // online 排在前面
        { usageCount: 'asc' }
      ]
    });

    if (apiKeys.length === 0) {
      throw new Error('系统暂未配置API密钥，请联系管理员');
    }

    // 优先选择在线的密钥
    const onlineKey = apiKeys.find(k => k.connectionStatus === 'online');
    const selectedKey = onlineKey || apiKeys[0];

    // 获取配置
    const defaultConfig = PROVIDER_CONFIGS[selectedKey.provider] || PROVIDER_CONFIGS.custom;
    const endpoint = selectedKey.customEndpoint || defaultConfig.endpoint;
    const model = selectedKey.customModel || defaultConfig.model;

    if (!endpoint) {
      throw new Error(`服务商 ${selectedKey.provider} 的接口地址未配置`);
    }

    // 更新使用统计
    await prisma.apiKey.update({
      where: { id: selectedKey.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });

    return {
      key: selectedKey.keyValue,
      provider: selectedKey.provider,
      endpoint,
      model
    };
  } catch (error) {
    console.error('Failed to get system API key:', error);
    throw error;
  }
}
