// 智能体接入测试示例 (JavaScript/Node.js)
// 演示如何通过MCP协议调用AI量表系统

class AIScaleClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.requestId = 0;
  }

  async callTool(endpoint, toolName, args) {
    this.requestId++;
    
    const url = `${this.baseUrl}/api/mcp/${endpoint}`;
    const payload = {
      jsonrpc: '2.0',
      id: String(this.requestId),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.result) {
        return JSON.parse(result.result.content[0].text);
      } else {
        return { error: result.error?.message || 'Unknown error' };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  async getToolsList(endpoint) {
    const url = `${this.baseUrl}/api/mcp/${endpoint}`;
    const payload = {
      jsonrpc: '2.0',
      id: 'tools-list',
      method: 'tools/list'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }

  async getUserMemory(deviceId) {
    return this.callTool('memory', 'get_user_memory', { deviceId });
  }

  async saveUserMemory(deviceId, { interest, fear }) {
    const args = { deviceId };
    if (interest) args.interest = interest;
    if (fear) args.fear = fear;
    return this.callTool('memory', 'save_user_memory', args);
  }

  async addGrowthRecord(deviceId, { ageMonths, weight, height, headCircumference }) {
    const args = { deviceId, ageMonths };
    if (weight) args.weight = weight;
    if (height) args.height = height;
    if (headCircumference) args.headCircumference = headCircumference;
    return this.callTool('growth', 'add_growth_record', args);
  }

  async getGrowthHistory(deviceId, limit = 10) {
    return this.callTool('growth', 'get_growth_history', { deviceId, limit });
  }

  async evaluateGrowth(deviceId) {
    return this.callTool('growth', 'evaluate_growth', { deviceId });
  }
}

// 测试函数
async function testMemorySkill() {
  console.log('\n' + '='.repeat(50));
  console.log('测试 Memory Skill');
  console.log('='.repeat(50));

  const client = new AIScaleClient();
  const testDeviceId = 'test-agent-001';

  // 1. 获取工具列表
  console.log('\n1. 获取工具列表...');
  const tools = await client.getToolsList('memory');
  console.log('可用工具：');
  tools.result.tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  // 2. 获取用户记忆
  console.log(`\n2. 获取用户记忆 (deviceId: ${testDeviceId})...`);
  const memory = await client.getUserMemory(testDeviceId);
  console.log('结果:', JSON.stringify(memory, null, 2));

  // 3. 保存用户记忆
  console.log('\n3. 保存用户记忆...');
  const result = await client.saveUserMemory(testDeviceId, {
    interest: '喜欢看旋转的东西',
    fear: '害怕大声音'
  });
  console.log('结果:', JSON.stringify(result, null, 2));
}

async function testGrowthSkill() {
  console.log('\n' + '='.repeat(50));
  console.log('测试 Growth Curve Skill');
  console.log('='.repeat(50));

  const client = new AIScaleClient();
  const testDeviceId = 'test-agent-001';

  // 1. 获取工具列表
  console.log('\n1. 获取工具列表...');
  const tools = await client.getToolsList('growth');
  console.log('可用工具：');
  tools.result.tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  // 2. 添加生长记录
  console.log('\n2. 添加生长记录...');
  const record = await client.addGrowthRecord(testDeviceId, {
    ageMonths: 6,
    weight: 7.5,
    height: 65,
    headCircumference: 42
  });
  console.log('结果:', JSON.stringify(record, null, 2));

  // 3. 获取生长历史
  console.log('\n3. 获取生长历史...');
  const history = await client.getGrowthHistory(testDeviceId, 5);
  console.log('结果:', JSON.stringify(history, null, 2));

  // 4. 综合评估
  console.log('\n4. 综合评估...');
  const evaluation = await client.evaluateGrowth(testDeviceId);
  console.log('结果:', JSON.stringify(evaluation, null, 2));
}

// 运行测试
async function runTests() {
  console.log('🤖 AI量表系统 - 智能体接入测试');
  console.log('='.repeat(50));

  try {
    await testMemorySkill();
    await testGrowthSkill();

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有测试完成！');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error.stack);
  }
}

runTests();
