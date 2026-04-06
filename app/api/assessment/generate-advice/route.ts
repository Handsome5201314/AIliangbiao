/**
 * AI 个性化建议生成 API
 * 根据评估结果生成个性化建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemApiKey, PROVIDER_CONFIGS } from '@/lib/services/apiKeyService';
import { prisma } from '@/lib/db/prisma';

interface AssessmentResult {
  scaleId: string;
  scaleName: string;
  totalScore: number;
  conclusion: string;
  details?: {
    description?: string;
    [key: string]: unknown;
  };
  childProfile?: {
    nickname: string;
    gender: string;
    ageMonths?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, result }: { deviceId: string; result: AssessmentResult } = body;

    if (!deviceId || !result) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取系统 API Key
    let apiKey: string, provider: string, endpoint: string, model: string;
    try {
      const keyData = await getSystemApiKey();
      apiKey = keyData.key;
      provider = keyData.provider;
      endpoint = keyData.endpoint;
      model = keyData.model;
      
      console.log('[Generate Advice] Using provider:', provider);
    } catch (error) {
      console.error('[Generate Advice] Failed to get API key:', error);
      return NextResponse.json(
        { error: '系统未配置 AI 服务，请在后台添加 API Key' },
        { status: 500 }
      );
    }

    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) {
      console.error('[Generate Advice] Invalid provider config:', provider);
      return NextResponse.json(
        { error: '无效的 AI 服务商配置' },
        { status: 500 }
      );
    }

    // 获取用户上下文
    let userContext = '';
    try {
      const user = await prisma.user.findFirst({
        where: { deviceId },
        include: {
          profiles: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (user?.profiles[0]) {
        const profile = user.profiles[0];
        userContext = `
儿童信息：
- 姓名：${profile.nickname}
- 性别：${profile.gender === 'boy' ? '男孩' : '女孩'}
${profile.ageMonths ? `- 月龄：${profile.ageMonths}个月` : ''}
`;
        
        if (profile.traits && typeof profile.traits === 'object') {
          const traits = profile.traits as Record<string, any>;
          if (traits.interests?.length) {
            userContext += `- 兴趣爱好：${traits.interests.join('、')}\n`;
          }
          if (traits.fears?.length) {
            userContext += `- 害怕的事物：${traits.fears.join('、')}\n`;
          }
          if (traits.behaviors?.length) {
            userContext += `- 行为特点：${traits.behaviors.join('、')}\n`;
          }
          if (traits.medicalHistory?.length) {
            userContext += `- 医疗史：${traits.medicalHistory.join('、')}\n`;
          }
        }
      }
    } catch (error) {
      console.error('获取用户上下文失败:', error);
    }

    // 构建 AI 提示词
    const systemPrompt = `你是一位专业的儿童心理评估师和儿童发展专家。你的任务是根据评估结果，为家长提供专业、温暖、个性化的建议和指导。

请遵循以下原则：
1. 专业准确：基于评估数据和儿童发展理论
2. 温暖共情：理解家长的关切，给予情感支持
3. 个性化：根据孩子特点和评估结果定制建议
4. 可操作性：提供具体、可执行的建议
5. 积极正向：关注孩子的优势和潜力
6. 保密提醒：提醒家长保护孩子隐私

建议应包含以下部分：
1. **评估解读**：简要解释评估结果的含义
2. **优势发现**：指出孩子的发展优势
3. **关注领域**：指出需要关注的方面
4. **具体建议**：提供3-5条可操作的建议
5. **家庭活动**：推荐适合的家庭互动活动
6. **专业支持**：建议何时寻求专业帮助
7. **鼓励话语**：给予家长信心和鼓励`;

    const userPrompt = `${userContext}

评估结果：
- 量表名称：${result.scaleName}
- 总分：${result.totalScore}
- 评估结论：${result.conclusion}
${result.details?.description ? `- 详细说明：${result.details.description}` : ''}

请根据以上信息，生成个性化的建议和指导。注意：
- 如果评估结果正常，重点关注如何保持和促进发展
- 如果评估结果显示需要关注，提供具体的干预建议
- 如果评估结果建议专业评估，说明原因并推荐下一步行动
- 所有建议都要结合孩子的年龄和性别特点`;

    // 调用 AI API
    console.log('[Generate Advice] Calling AI API:', endpoint);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Generate Advice] AI API error:', response.status, errorText);
      
      // 友好的错误提示
      let errorMessage = 'AI 服务调用失败';
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMessage = `${providerConfig.name} 服务暂时不可用，请稍后重试或更换其他 AI 服务商`;
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'API 密钥无效或已过期，请检查后台配置';
      } else if (response.status === 429) {
        errorMessage = 'API 调用频率超限，请稍后重试';
      } else if (response.status === 402 || errorText.includes('insufficient')) {
        errorMessage = `${providerConfig.name} 账户余额不足，请充值后重试`;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    const data = await response.json();
    const advice = data.choices[0]?.message?.content || '无法生成建议';

    return NextResponse.json({
      success: true,
      advice,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Generate Advice Error]:', error);
    const errorMessage = error instanceof Error ? error.message : '生成建议失败，请稍后重试';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
