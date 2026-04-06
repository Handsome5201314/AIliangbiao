/**
 * 修复 API Keys - 将 custom provider 改为实际的服务商
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function fixApiKeys() {
  try {
    console.log('🔧 API Key 修复工具\n');

    // 显示所有 custom provider 的 API Keys
    const customKeys = await prisma.apiKey.findMany({
      where: { provider: 'custom' }
    });

    if (customKeys.length === 0) {
      console.log('✅ 没有需要修复的 API Key (custom provider)\n');
      return;
    }

    console.log(`找到 ${customKeys.length} 个 custom provider 的 API Key:\n`);
    customKeys.forEach((key, index) => {
      console.log(`${index + 1}. ID: ${key.id}`);
      console.log(`   Key Name: ${key.keyName}`);
      console.log(`   Key Value: ${key.keyValue.substring(0, 10)}...`);
      console.log(`   Provider: ${key.provider}\n`);
    });

    // 显示可用的 provider 选项
    const providers = [
      { value: 'siliconflow', label: '硅基流动 (推荐)' },
      { value: 'sophon', label: '算能' },
      { value: 'deepseek', label: 'DeepSeek' },
      { value: 'qwen', label: '通义千问' },
      { value: 'openai', label: 'OpenAI' }
    ];

    console.log('可用的服务商:');
    providers.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.label} (${p.value})`);
    });
    console.log('');

    // 选择要更新为哪个 provider
    const choice = await question('请选择要更新为哪个服务商 (输入数字 1-5): ');
    const providerIndex = parseInt(choice) - 1;
    
    if (providerIndex < 0 || providerIndex >= providers.length) {
      console.log('❌ 无效的选择');
      return;
    }

    const newProvider = providers[providerIndex].value;
    console.log(`\n将所有 custom provider 更新为: ${newProvider}\n`);

    const confirm = await question('确认更新？ (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ 取消更新');
      return;
    }

    // 执行更新
    const result = await prisma.apiKey.updateMany({
      where: { provider: 'custom' },
      data: { provider: newProvider }
    });

    console.log(`\n✅ 成功更新 ${result.count} 个 API Key 的 provider 为 ${newProvider}\n`);

    // 显示更新后的结果
    const updatedKeys = await prisma.apiKey.findMany({
      where: { provider: newProvider },
      select: {
        id: true,
        keyName: true,
        provider: true,
        isActive: true
      }
    });

    console.log('更新后的 API Keys:');
    updatedKeys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key.keyName} (${key.provider}) - Active: ${key.isActive}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

fixApiKeys();
