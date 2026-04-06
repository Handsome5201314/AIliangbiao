/**
 * 检查各个 AI 服务商的可用性
 */

const PROVIDER_CONFIGS = {
  siliconflow: {
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    testKey: null // 需要用户提供
  },
  sophon: {
    name: '算能',
    endpoint: 'https://api.sophon.cn/v1/chat/completions',
    testKey: null
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    testKey: null
  },
  qwen: {
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    testKey: null
  },
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    testKey: null
  }
};

async function checkProvider(name, endpoint) {
  try {
    console.log(`正在检查 ${name}...`);
    
    // 发送一个简单的 OPTIONS 请求检查连接
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    const response = await fetch(endpoint, {
      method: 'HEAD',
      signal: controller.signal
    }).catch(err => {
      if (err.name === 'AbortError') {
        return { ok: false, status: 'TIMEOUT', statusText: '请求超时' };
      }
      return { ok: false, status: 'ERROR', statusText: err.message };
    });
    
    clearTimeout(timeoutId);
    
    if (response.status === 'TIMEOUT') {
      return { status: '❌', message: '连接超时（可能需要翻墙）' };
    }
    
    if (response.status === 'ERROR') {
      return { status: '❌', message: `连接失败: ${response.statusText}` };
    }
    
    if (response.ok || response.status === 200 || response.status === 401 || response.status === 403 || response.status === 404) {
      return { status: '✅', message: '服务可用（需要有效的 API Key）' };
    }
    
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return { status: '⚠️', message: '服务暂时不可用，请稍后重试' };
    }
    
    return { status: '❓', message: `未知状态 (${response.status})` };
    
  } catch (error) {
    return { status: '❌', message: `检查失败: ${error.message}` };
  }
}

async function main() {
  console.log('🔍 检查各个 AI 服务商的可用性...\n');
  console.log('提示：这个检查只是测试网络连接，不代表 API Key 是否有效\n');
  console.log('='.repeat(60) + '\n');

  const results = [];
  
  for (const [id, config] of Object.entries(PROVIDER_CONFIGS)) {
    const result = await checkProvider(config.name, config.endpoint);
    results.push({
      name: config.name,
      id: id,
      ...result
    });
    console.log(`${result.status} ${config.name.padEnd(12)} - ${result.message}\n`);
  }

  console.log('='.repeat(60) + '\n');
  
  console.log('📊 检查结果汇总:\n');
  results.forEach(r => {
    console.log(`${r.status} ${r.name} (${r.id})`);
  });
  
  console.log('\n💡 建议:\n');
  
  const available = results.filter(r => r.status === '✅');
  const warning = results.filter(r => r.status === '⚠️');
  const unavailable = results.filter(r => r.status === '❌');
  
  if (available.length > 0) {
    console.log('✅ 可用服务商:', available.map(r => r.name).join(', '));
  }
  
  if (warning.length > 0) {
    console.log('⚠️  暂时不可用:', warning.map(r => r.name).join(', '));
    console.log('   建议：等待恢复或使用其他服务商');
  }
  
  if (unavailable.length > 0) {
    console.log('❌ 无法连接:', unavailable.map(r => r.name).join(', '));
    console.log('   建议：检查网络或使用其他服务商');
  }
  
  console.log('\n📚 推荐服务商:');
  console.log('   1. 硅基流动 - 新用户送14元，稳定可靠');
  console.log('   2. DeepSeek - 性价比高，新用户有免费额度');
  console.log('   3. 通义千问 - 阿里云出品，稳定\n');
}

main();
