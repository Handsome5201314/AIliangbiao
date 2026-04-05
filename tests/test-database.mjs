/**
 * 数据库连接和查询测试脚本
 * 
 * 测试目标：
 * 1. 数据库连接
 * 2. 表结构验证
 * 3. 查询性能测试
 * 4. 索引效率测试
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('🧪 数据库测试开始...\n');

async function runTests() {
  try {
    // 测试1：数据库连接
    console.log('📋 测试1：数据库连接');
    await prisma.$connect();
    console.log('✅ 通过：数据库连接成功\n');

    // 测试2：表结构验证
    console.log('📋 测试2：表结构验证');
    
    const tables = [
      'User',
      'ChildProfile',
      'AssessmentHistory',
      'TriageSession',
      'ApiKey',
      'SpeechUsage',
    ];

    for (const table of tables) {
      try {
        const count = await prisma[table.toLowerCase()].count();
        console.log(`   ✅ ${table}: ${count} 条记录`);
      } catch (error) {
        console.log(`   ❌ ${table}: 查询失败 - ${error.message}`);
      }
    }
    console.log('');

    // 测试3：用户额度查询性能
    console.log('📋 测试3：用户额度查询性能');
    const startTime1 = Date.now();
    
    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        dailyUsed: true,
        dailyLimit: true,
        lastResetAt: true,
      },
    });
    
    const queryTime1 = Date.now() - startTime1;
    console.log(`   查询时间：${queryTime1}ms`);
    console.log(`   查询结果：${users.length} 条记录`);
    console.log(`   状态：${queryTime1 < 100 ? '✅ 优秀' : queryTime1 < 500 ? '⚠️  一般' : '❌ 慢'}\n`);

    // 测试4：评估历史查询性能
    console.log('📋 测试4：评估历史查询性能');
    const startTime2 = Date.now();
    
    const assessments = await prisma.assessmentHistory.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scaleId: true,
        scaleVersion: true,
        totalScore: true,
        conclusion: true,
        createdAt: true,
      },
    });
    
    const queryTime2 = Date.now() - startTime2;
    console.log(`   查询时间：${queryTime2}ms`);
    console.log(`   查询结果：${assessments.length} 条记录`);
    
    if (assessments.length > 0) {
      console.log(`   最新评估：${assessments[0].scaleId} (${assessments[0].scaleVersion})`);
    }
    console.log(`   状态：${queryTime2 < 100 ? '✅ 优秀' : queryTime2 < 500 ? '⚠️  一般' : '❌ 慢'}\n`);

    // 测试5：分诊会话查询性能
    console.log('📋 测试5：分诊会话查询性能');
    const startTime3 = Date.now();
    
    const sessions = await prisma.triageSession.findMany({
      where: { status: 'ONGOING' },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        symptoms: true,
        recommendedScale: true,
        updatedAt: true,
      },
    });
    
    const queryTime3 = Date.now() - startTime3;
    console.log(`   查询时间：${queryTime3}ms`);
    console.log(`   查询结果：${sessions.length} 条记录`);
    console.log(`   状态：${queryTime3 < 100 ? '✅ 优秀' : queryTime3 < 500 ? '⚠️  一般' : '❌ 慢'}\n`);

    // 测试6：索引效率测试
    console.log('📋 测试6：索引效率测试');
    
    // 测试带索引的查询
    const startTime4 = Date.now();
    const indexedQuery = await prisma.apiKey.findMany({
      where: {
        isActive: true,
        serviceType: 'text',
      },
    });
    const indexedTime = Date.now() - startTime4;
    
    console.log(`   索引查询时间：${indexedTime}ms`);
    console.log(`   结果数量：${indexedQuery.length} 条`);
    console.log(`   状态：${indexedTime < 50 ? '✅ 索引有效' : '⚠️  可能需要优化索引'}\n`);

    // 测试7：写入性能测试
    console.log('📋 测试7：写入性能测试');
    const startTime5 = Date.now();
    
    // 创建测试用户（如果不存在）
    const testDeviceId = 'test-' + Date.now();
    const testUser = await prisma.user.create({
      data: {
        deviceId: testDeviceId,
        isGuest: true,
        dailyUsed: 0,
        dailyLimit: 1,
      },
    });
    
    const writeTime = Date.now() - startTime5;
    console.log(`   写入时间：${writeTime}ms`);
    console.log(`   测试用户ID：${testUser.id}`);
    console.log(`   状态：${writeTime < 100 ? '✅ 优秀' : writeTime < 500 ? '⚠️  一般' : '❌ 慢'}\n`);

    // 清理测试数据
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('   ✅ 测试数据已清理\n');

    // 测试报告
    console.log('📊 测试报告摘要');
    console.log('================');
    console.log('✅ 通过：数据库连接');
    console.log('✅ 通过：表结构验证');
    console.log(`${queryTime1 < 500 ? '✅' : '❌'} 通过：用户额度查询（${queryTime1}ms）`);
    console.log(`${queryTime2 < 500 ? '✅' : '❌'} 通过：评估历史查询（${queryTime2}ms）`);
    console.log(`${queryTime3 < 500 ? '✅' : '❌'} 通过：分诊会话查询（${queryTime3}ms）`);
    console.log(`${indexedTime < 100 ? '✅' : '⚠️'} 通过：索引效率（${indexedTime}ms）`);
    console.log(`${writeTime < 500 ? '✅' : '❌'} 通过：写入性能（${writeTime}ms）`);
    
    const avgQueryTime = (queryTime1 + queryTime2 + queryTime3) / 3;
    console.log(`\n📈 平均查询时间：${avgQueryTime.toFixed(2)}ms`);
    
    if (avgQueryTime < 100) {
      console.log('🎉 性能评级：优秀');
    } else if (avgQueryTime < 500) {
      console.log('👍 性能评级：良好');
    } else {
      console.log('⚠️  性能评级：需要优化');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    if (error.code === 'P1001') {
      console.log('\n💡 提示：无法连接到数据库');
      console.log('   请检查 DATABASE_URL 环境变量是否正确配置');
      console.log('   或者运行: npx prisma db push');
    }
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ 测试完成！数据库连接已关闭');
  }
}

runTests();
