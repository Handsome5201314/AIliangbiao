/**
 * 语音识别配置诊断脚本
 * 
 * 用途：检查语音识别 API Key 配置是否正确
 * 运行：node diagnose-speech-api.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('========================================');
  console.log('  语音识别配置诊断');
  console.log('========================================\n');

  try {
    // 1. 检查所有 API Keys
    console.log('📋 步骤 1：检查所有 API Keys...\n');
    const allKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        provider: true,
        serviceType: true,
        keyName: true,
        customModel: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (allKeys.length === 0) {
      console.log('❌ 没有找到任何 API Key');
      console.log('解决方案：访问 http://localhost:3000/admin/apikeys 添加 API Key\n');
      return;
    }

    console.log(`找到 ${allKeys.length} 个 API Key：\n`);
    allKeys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.keyName}`);
      console.log(`   - 服务商：${key.provider}`);
      console.log(`   - 服务类型：${key.serviceType || 'text'}`);
      console.log(`   - 模型：${key.customModel || '默认'}`);
      console.log(`   - 状态：${key.isActive ? '✅ 启用' : '❌ 禁用'}\n`);
    });

    // 2. 检查语音识别 API Keys
    console.log('📋 步骤 2：检查语音识别 API Keys...\n');
    const speechKeys = await prisma.apiKey.findMany({
      where: { serviceType: 'speech' },
      select: {
        id: true,
        provider: true,
        keyName: true,
        customModel: true,
        isActive: true,
        connectionStatus: true,
      },
    });

    if (speechKeys.length === 0) {
      console.log('❌ 没有找到语音识别 API Key');
      console.log('');
      console.log('🔧 解决方案：');
      console.log('1. 访问：http://localhost:3000/admin/apikeys');
      console.log('2. 点击"添加密钥"');
      console.log('3. 填写信息：');
      console.log('   - 服务商：SiliconFlow');
      console.log('   - 服务类型：语音识别模型 ← 重要！');
      console.log('   - 密钥名称：SiliconFlow 语音识别');
      console.log('   - API Key：sk-xxxxxxxx');
      console.log('   - 模型：FunAudioLLM/SenseVoiceSmall');
      console.log('');
      return;
    }

    console.log(`找到 ${speechKeys.length} 个语音识别 API Key：\n`);
    speechKeys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.keyName}`);
      console.log(`   - 服务商：${key.provider}`);
      console.log(`   - 模型：${key.customModel || '默认'}`);
      console.log(`   - 状态：${key.isActive ? '✅ 启用' : '❌ 禁用'}`);
      console.log(`   - 连接状态：${key.connectionStatus || 'unknown'}\n`);
    });

    // 3. 检查激活的语音识别 API Key
    console.log('📋 步骤 3：检查激活的语音识别 API Keys...\n');
    const activeSpeechKeys = await prisma.apiKey.findMany({
      where: {
        serviceType: 'speech',
        isActive: true,
      },
    });

    if (activeSpeechKeys.length === 0) {
      console.log('❌ 没有激活的语音识别 API Key');
      console.log('解决方案：在后台启用语音识别 API Key\n');
      return;
    }

    console.log(`✅ 找到 ${activeSpeechKeys.length} 个激活的语音识别 API Key\n`);

    // 4. 检查模型名称
    console.log('📋 步骤 4：检查模型名称...\n');
    const supportedModels = {
      siliconflow: ['FunAudioLLM/SenseVoiceSmall', 'TeleAI/TeleSpeechASR'],
      openai: ['whisper-1'],
    };

    let hasCorrectModel = false;
    activeSpeechKeys.forEach((key) => {
      const supported = supportedModels[key.provider] || [];
      const isCorrect = supported.includes(key.customModel);
      
      console.log(`${key.keyName}：`);
      console.log(`   - 模型：${key.customModel || '未设置'}`);
      console.log(`   - 是否正确：${isCorrect ? '✅ 正确' : '❌ 错误'}`);
      
      if (isCorrect) {
        hasCorrectModel = true;
      }
      
      if (!isCorrect) {
        console.log(`   - 支持的模型：${supported.join(', ')}`);
      }
      console.log('');
    });

    // 5. 总结
    console.log('========================================');
    console.log('  诊断总结');
    console.log('========================================\n');

    if (hasCorrectModel) {
      console.log('✅ 配置正确！');
      console.log('');
      console.log('下一步：测试语音识别功能');
      console.log('1. 访问首页：http://localhost:3000');
      console.log('2. 点击麦克风录音');
      console.log('3. 说话测试');
      console.log('');
    } else {
      console.log('❌ 配置有问题');
      console.log('');
      console.log('请检查：');
      console.log('1. 确保模型名称正确');
      console.log('2. SiliconFlow 支持的模型：');
      console.log('   - FunAudioLLM/SenseVoiceSmall（推荐）');
      console.log('   - TeleAI/TeleSpeechASR');
      console.log('');
    }

  } catch (error) {
    console.error('❌ 诊断失败：', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
