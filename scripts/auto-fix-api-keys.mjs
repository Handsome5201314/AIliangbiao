/**
 * 自动修复 API Keys - 将 custom provider 改为 siliconflow
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function autoFixApiKeys() {
  try {
    console.log('🔧 自动修复 API Keys...\n');

    // 显示修复前的状态
    const beforeKeys = await prisma.apiKey.findMany({
      where: { provider: 'custom' }
    });

    console.log(`找到 ${beforeKeys.length} 个需要修复的 API Key (custom provider)\n`);

    if (beforeKeys.length === 0) {
      console.log('✅ 没有需要修复的 API Key\n');
      return;
    }

    // 自动更新为 siliconflow
    const result = await prisma.apiKey.updateMany({
      where: { provider: 'custom' },
      data: { provider: 'siliconflow' }
    });

    console.log(`✅ 成功更新 ${result.count} 个 API Key`);
    console.log(`   Provider: custom → siliconflow\n`);

    // 显示修复后的状态
    const afterKeys = await prisma.apiKey.findMany({
      where: { provider: 'siliconflow' },
      select: {
        id: true,
        keyName: true,
        provider: true,
        isActive: true,
        keyValue: true
      }
    });

    console.log('更新后的 API Keys:');
    afterKeys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key.keyName}`);
      console.log(`     Provider: ${key.provider}`);
      console.log(`     Key: ${key.keyValue.substring(0, 15)}...`);
      console.log(`     Active: ${key.isActive ? '✅' : '❌'}`);
    });
    console.log('');

    console.log('💡 提示:');
    console.log('   - 现在可以正常使用 AI 服务了');
    console.log('   - 如果您的 API Key 不是硅基流动的，请在后台重新添加');
    console.log('   - 后台地址: http://localhost:3000/admin/apikeys\n');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

autoFixApiKeys();
