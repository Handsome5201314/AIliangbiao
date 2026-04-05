/**
 * 检查数据库中的 API Keys
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkApiKeys() {
  try {
    console.log('🔍 检查数据库中的 API Keys...\n');

    // 查询所有 API Keys
    const allKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        provider: true,
        keyName: true,
        isActive: true,
        userId: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 总共找到 ${allKeys.length} 个 API Key\n`);

    if (allKeys.length === 0) {
      console.log('❌ 数据库中没有 API Key');
      console.log('💡 请在后台添加 API Key：http://localhost:3000/admin/apikeys\n');
      return;
    }

    // 分类显示
    const systemKeys = allKeys.filter(k => k.userId === null);
    const userKeys = allKeys.filter(k => k.userId !== null);

    console.log('🔧 系统级 API Keys:');
    if (systemKeys.length === 0) {
      console.log('  ❌ 没有系统级 API Key（这是问题所在！）');
      console.log('  💡 系统级 Key 的 userId 必须为 null\n');
    } else {
      systemKeys.forEach((key, index) => {
        console.log(`  ${index + 1}. ${key.keyName}`);
        console.log(`     - Provider: ${key.provider}`);
        console.log(`     - Active: ${key.isActive ? '✅' : '❌'}`);
        console.log(`     - Usage Count: ${key.usageCount}`);
        console.log(`     - Created: ${key.createdAt}`);
      });
      console.log('');
    }

    console.log('👤 用户级 API Keys:');
    if (userKeys.length === 0) {
      console.log('  没有用户级 API Key\n');
    } else {
      userKeys.forEach((key, index) => {
        console.log(`  ${index + 1}. ${key.keyName} (User: ${key.userId})`);
        console.log(`     - Provider: ${key.provider}`);
        console.log(`     - Active: ${key.isActive ? '✅' : '❌'}`);
      });
      console.log('');
    }

    // 检查是否有活跃的系统级 Key
    const activeSystemKeys = systemKeys.filter(k => k.isActive);
    if (activeSystemKeys.length === 0) {
      console.log('⚠️  警告：没有活跃的系统级 API Key！');
      console.log('   请确保：');
      console.log('   1. 在后台添加 API Key 时，userId 留空或设为 null');
      console.log('   2. API Key 的 isActive 设为 true');
      console.log('   3. Provider 选择正确的服务商\n');
    } else {
      console.log(`✅ 有 ${activeSystemKeys.length} 个活跃的系统级 API Key\n`);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkApiKeys();
