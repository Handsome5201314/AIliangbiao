/**
 * 检查算能 API Key 配置
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSophonKey() {
  try {
    console.log('🔍 检查算能 API Key 配置...\n');

    // 查询所有 API Keys
    const allKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        provider: true,
        keyName: true,
        keyValue: true,
        isActive: true,
        userId: true,
        usageCount: true
      },
      orderBy: {
        usageCount: 'asc'
      }
    });

    console.log(`📊 总共找到 ${allKeys.length} 个 API Key\n`);

    // 显示所有 Key
    allKeys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.keyName}`);
      console.log(`   ID: ${key.id}`);
      console.log(`   Provider: "${key.provider}"`);
      console.log(`   Key: ${key.keyValue.substring(0, 15)}...`);
      console.log(`   Active: ${key.isActive ? '✅' : '❌'}`);
      console.log(`   System Key: ${key.userId === null ? '✅' : '❌'}`);
      console.log(`   Usage Count: ${key.usageCount}`);
      console.log('');
    });

    // 检查第一个活跃的系统级 Key（这是会被使用的）
    const activeSystemKey = allKeys.find(k => k.isActive && k.userId === null);
    
    if (activeSystemKey) {
      console.log('🎯 将会被使用的 API Key:');
      console.log(`   Provider: "${activeSystemKey.provider}"`);
      console.log(`   Key Name: ${activeSystemKey.keyName}`);
      
      // 检查 provider 配置
      const PROVIDER_CONFIGS = {
        siliconflow: { endpoint: 'https://api.siliconflow.cn/v1/chat/completions', model: 'Qwen/Qwen2.5-7B-Instruct' },
        sophon: { endpoint: 'https://api.sophon.cn/v1/chat/completions', model: 'sophon-chat' },
        deepseek: { endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
        qwen: { endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', model: 'qwen-turbo' },
        openai: { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-3.5-turbo' },
        custom: { endpoint: '', model: '' }
      };

      const config = PROVIDER_CONFIGS[activeSystemKey.provider];
      
      if (!config) {
        console.log(`   ❌ 错误：Provider "${activeSystemKey.provider}" 不在配置列表中！`);
        console.log(`   可用的 Providers: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`);
      } else {
        console.log(`   ✅ 配置存在`);
        console.log(`   Endpoint: ${config.endpoint || '(空)'}`);
        console.log(`   Model: ${config.model || '(空)'}`);
        
        if (!config.endpoint) {
          console.log(`   ❌ 错误：Endpoint 为空！`);
        }
      }
    } else {
      console.log('❌ 没有找到活跃的系统级 API Key');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSophonKey();
