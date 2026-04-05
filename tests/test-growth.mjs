// 测试 Growth Curve Skill API

async function testGrowthAPI() {
  console.log('========================================');
  console.log('  Growth Curve Skill API 测试');
  console.log('========================================\n');

  const testDeviceId = 'test-growth-001';

  // 测试 1: GET 服务状态
  console.log('测试 1: 获取服务状态...');
  try {
    const res = await fetch('http://localhost:3000/api/mcp/growth');
    const data = await res.json();
    console.log('✅ 服务状态:', data.status);
    console.log('  服务名:', data.service);
    console.log('  描述:', data.description);
    console.log('  工具数:', data.tools.length);
  } catch (error) {
    console.log('❌ 失败:', error.message);
    process.exit(1);
  }

  console.log('\n');

  // 测试 2: 获取工具列表
  console.log('测试 2: 获取工具列表...');
  try {
    const res = await fetch('http://localhost:3000/api/mcp/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-001',
        method: 'tools/list'
      })
    });
    const data = await res.json();
    console.log('✅ 成功获取工具列表:');
    data.result.tools.forEach(tool => {
      console.log(`  - ${tool.name}`);
      console.log(`    ${tool.description}`);
    });
  } catch (error) {
    console.log('❌ 失败:', error.message);
    process.exit(1);
  }

  console.log('\n');

  // 测试 3: 添加生长记录（3个月男婴）
  console.log('测试 3: 添加生长记录（3个月男婴）...');
  try {
    const res = await fetch('http://localhost:3000/api/mcp/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-002',
        method: 'tools/call',
        params: {
          name: 'add_growth_record',
          arguments: {
            deviceId: testDeviceId,
            ageMonths: 3,
            weight: 6.5,
            height: 61,
            headCircumference: 40,
            notes: '3个月体检'
          }
        }
      })
    });
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    
    if (result.error) {
      console.log('⚠️  预期错误:', result.error);
    } else {
      console.log('✅ 记录已保存:');
      console.log('  月龄:', result.record.ageMonths, '个月');
      console.log('  体重:', result.record.weight, 'kg');
      console.log('  身高:', result.record.height, 'cm');
      console.log('  头围:', result.record.headCircumference, 'cm');
      console.log('\n  评估结果:');
      console.log('  体重:', `P${result.record.evaluations.weight.percentile}`, result.record.evaluations.weight.status);
      console.log('  身高:', `P${result.record.evaluations.height.percentile}`, result.record.evaluations.height.status);
      console.log('  头围:', `P${result.record.evaluations.headCircumference.percentile}`, result.record.evaluations.headCircumference.status);
    }
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n');

  // 测试 4: 获取生长历史
  console.log('测试 4: 获取生长历史...');
  try {
    const res = await fetch('http://localhost:3000/api/mcp/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-003',
        method: 'tools/call',
        params: {
          name: 'get_growth_history',
          arguments: {
            deviceId: testDeviceId,
            limit: 5
          }
        }
      })
    });
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    
    if (result.error) {
      console.log('⚠️  预期错误:', result.error);
    } else {
      console.log('✅ 生长历史:');
      console.log('  宝宝昵称:', result.nickname);
      console.log('  性别:', result.gender);
      console.log('  记录数:', result.records.length);
      result.records.forEach((record, i) => {
        console.log(`\n  记录 ${i + 1}:`);
        console.log('    月龄:', record.ageMonths, '个月');
        console.log('    体重:', record.weight, 'kg (P' + record.weightPercentile + ')');
        console.log('    身高:', record.height, 'cm (P' + record.heightPercentile + ')');
        console.log('    头围:', record.headCircumference, 'cm (P' + record.headPercentile + ')');
      });
    }
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n');

  // 测试 5: 综合评估
  console.log('测试 5: 综合评估...');
  try {
    const res = await fetch('http://localhost:3000/api/mcp/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-004',
        method: 'tools/call',
        params: {
          name: 'evaluate_growth',
          arguments: {
            deviceId: testDeviceId
          }
        }
      })
    });
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    
    if (result.error) {
      console.log('⚠️  预期错误:', result.error);
    } else {
      console.log('✅ 综合评估:');
      console.log('  宝宝昵称:', result.nickname);
      console.log('  当前月龄:', result.ageMonths, '个月');
      console.log('\n  指标详情:');
      console.log('  体重:', result.evaluation.weight.value, 'kg, P' + result.evaluation.weight.percentile, result.evaluation.weight.status);
      console.log('  身高:', result.evaluation.height.value, 'cm, P' + result.evaluation.height.percentile, result.evaluation.height.status);
      console.log('  头围:', result.evaluation.headCircumference.value, 'cm, P' + result.evaluation.headCircumference.percentile, result.evaluation.headCircumference.status);
      console.log('\n  建议:');
      result.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n========================================');
  console.log('  测试完成！');
  console.log('========================================');
}

testGrowthAPI().catch(console.error);
