/**
 * 修复算能 API Key 的 Provider
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSophonKey() {
  try {
    console.log('🔧 修复算能 API Key...\n');

    // 查找所有 custom provider 的 Key
    const customKeys = await prisma.apiKey.findMany({
      where: { provider: 'custom' }
    });

    console.log(`找到 ${customKeys.length} 个 custom provider 的 API Key\n`);

    if (customKeys.length === 0) {
      console.log('✅ 没有需要修复的 Key\n');
      return;
    }

    // 显示找到的 Key
    customKeys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.keyName}`);
      console.log(`   Key: ${key.keyValue.substring(0, 15)}...`);
      console.log(`   Current Provider: ${key.provider}\n`);
    });

    // 更新为算能
    const result = await prisma.apiKey.updateMany({
      where: { provider: 'custom' },
      data: { provider: 'sophon' }
    });

    console.log(`✅ 成功更新 ${result.count} 个 API Key`);
    console.log(`   Provider: custom → sophon\n`);

    // 显示更新后的配置
    const PROVIDER_CONFIGS = {
      sophon: { 
        endpoint: 'https://api.sophon.cn/v1/chat/completions', 
        model: 'sophon-chat',
        name: '算能'
      }
    };

    console.log('📝 算能配置信息:');
    console.log(`   Endpoint: ${PROVIDER_CONFIGS.sophon.endpoint}`);
    console.log(`   Model: ${PROVIDER_CONFIGS.sophon.model}`);
    console.log(`   Name: ${PROVIDER_CONFIGS.sophon.name}\n`);

    console.log('✅ 修复完成！现在可以正常使用算能 API 了。\n');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSophonKey();
