// 测试量表服务MCP接口

async function testScaleMCP() {
  console.log('========================================');
  console.log('  测试量表服务 MCP 接口');
  console.log('========================================\n');

  const endpoint = 'http://localhost:3000/api/mcp/scale';
  
  // 测试1: 获取服务信息
  console.log('测试1: 获取服务信息...');
  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    console.log('✅ 服务信息:');
    console.log(`  服务名: ${data.service}`);
    console.log(`  版本: ${data.version}`);
    console.log(`  状态: ${data.status}`);
    console.log(`  支持量表: ${data.supportedScales.length}个`);
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n');

  // 测试2: 获取工具列表
  console.log('测试2: 获取工具列表...');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/list'
      })
    });
    const data = await res.json();
    console.log('✅ 可用工具:');
    data.result.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n');

  // 测试3: 获取量表列表
  console.log('测试3: 获取量表列表...');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '2',
        method: 'tools/call',
        params: {
          name: 'list_scales',
          arguments: {}
        }
      })
    });
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    console.log('✅ 量表列表:');
    console.log(`  总数: ${result.totalCount}个`);
    result.scales.forEach(scale => {
      console.log(`  - ${scale.id}: ${scale.title} (${scale.questionCount}题)`);
    });
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n');

  // 测试4: 获取量表问题
  console.log('测试4: 获取ABC量表问题...');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '3',
        method: 'tools/call',
        params: {
          name: 'get_scale_questions',
          arguments: { scaleId: 'ABC' }
        }
      })
    });
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    console.log('✅ ABC量表:');
    console.log(`  题目数: ${result.questionCount}`);
    console.log(`  第1题: ${result.questions[0].question}`);
    console.log(`  选项: ${result.questions[0].options.join(', ')}`);
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n');

  // 测试5: 提交评估
  console.log('测试5: 提交评估（模拟答案）...');
  try {
    // 生成模拟答案（57题ABC量表）
    const mockAnswers = Array(57).fill(0).map(() => Math.floor(Math.random() * 4));
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '4',
        method: 'tools/call',
        params: {
          name: 'submit_assessment',
          arguments: {
            deviceId: 'test-device-001',
            scaleId: 'ABC',
            answers: mockAnswers
          }
        }
      })
    });
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    
    if (result.success) {
      console.log('✅ 评估成功:');
      console.log(`  评估ID: ${result.assessmentId}`);
      console.log(`  总分: ${result.totalScore}`);
      console.log(`  结论: ${result.conclusion}`);
      console.log(`  时间: ${result.evaluatedAt}`);
    } else {
      console.log('⚠️  评估失败:', result.error);
    }
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }

  console.log('\n========================================');
  console.log('  测试完成！');
  console.log('========================================');
}

testScaleMCP().catch(console.error);
