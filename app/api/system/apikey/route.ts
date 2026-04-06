import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// 支持的AI服务商配置
const PROVIDER_CONFIGS: Record<string, { endpoint: string; model: string; name: string }> = {
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
 * 用于前端调用AI服务
 */
export async function GET() {
  try {
    // 获取所有活跃的系统级API密钥
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        isActive: true,
        userId: null  // 系统级密钥
      },
      select: {
        id: true,
        provider: true,
        keyName: true,
        keyValue: true,
        usageCount: true
      },
      orderBy: {
        usageCount: 'asc'  // 优先使用调用次数少的，实现负载均衡
      }
    });

    if (apiKeys.length === 0) {
      return NextResponse.json({
        success: false,
        error: '系统暂未配置API密钥，请联系管理员'
      }, { status: 404 });
    }

    // 返回第一个可用的密钥（按调用次数排序）
    const selectedKey = apiKeys[0];
    const config = PROVIDER_CONFIGS[selectedKey.provider] || PROVIDER_CONFIGS.custom;

    // 更新使用统计
    await prisma.apiKey.update({
      where: { id: selectedKey.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      provider: selectedKey.provider,
      apiKey: selectedKey.keyValue,
      endpoint: config.endpoint,
      model: config.model,
      providerName: config.name
    });
  } catch (error) {
    console.error('Failed to fetch system API key:', error);
    return NextResponse.json({
      success: false,
      error: '获取API密钥失败'
    }, { status: 500 });
  }
}
