/**
 * AI 个性化建议生成 API
 * 根据评估结果生成个性化建议
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { getSystemApiKey, PROVIDER_CONFIGS } from '@/lib/services/apiKeyService';
import { getScaleDefinitionById } from '@/lib/scales/catalog';

interface AssessmentResultPayload {
  scaleId: string;
  scaleName: string;
  totalScore: number;
  conclusion: string;
  details?: {
    description?: string;
    dimensionResults?: Array<{
      id: string;
      label: string;
      score: number;
      displayValue?: string;
      description?: string;
    }>;
    [key: string]: unknown;
  };
  patientInfo?: Record<string, string | number | null>;
}

function formatGender(gender: string) {
  if (gender === 'boy' || gender === 'male') return '男';
  if (gender === 'girl' || gender === 'female') return '女';
  return gender;
}

function buildStructuredPatientInfo(
  result: AssessmentResultPayload,
  isChildScale: boolean
): string {
  const scale = getScaleDefinitionById(result.scaleId);
  const patientInfoFields = scale?.patientInfoFields ?? [];
  if (!patientInfoFields.length || !result.patientInfo) {
    return '';
  }

  const rows = patientInfoFields
    .map((field) => {
      const value = result.patientInfo?.[field.id];
      if (value === null || value === undefined || value === '') {
        return null;
      }
      return `- ${field.label}：${String(value)}`;
    })
    .filter((item): item is string => Boolean(item));

  if (!rows.length) {
    return '';
  }

  return `${isChildScale ? '受测者信息' : '患者信息'}：\n${rows.join('\n')}\n`;
}

async function buildProfileContext(deviceId: string, isChildScale: boolean) {
  try {
    const user = await prisma.user.findFirst({
      where: { deviceId },
      include: {
        profiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user?.profiles[0]) {
      return '';
    }

    const profile = user.profiles[0];
    let context = `${isChildScale ? '儿童信息' : '成员信息'}：\n`;
    context += `- 姓名：${profile.nickname}\n`;
    context += `- 性别：${formatGender(profile.gender)}\n`;
    if (profile.ageMonths) {
      context += isChildScale ? `- 月龄：${profile.ageMonths}个月\n` : `- 年龄（月龄记录）：${profile.ageMonths}个月\n`;
    }

    if (profile.traits && typeof profile.traits === 'object') {
      const traits = profile.traits as Record<string, unknown>;
      if (Array.isArray(traits.interests) && traits.interests.length) {
        context += `- 兴趣爱好：${traits.interests.join('、')}\n`;
      }
      if (Array.isArray(traits.fears) && traits.fears.length) {
        context += `- 害怕的事物：${traits.fears.join('、')}\n`;
      }
      if (Array.isArray(traits.behaviors) && traits.behaviors.length) {
        context += `- 行为特点：${traits.behaviors.join('、')}\n`;
      }
      if (Array.isArray(traits.medicalHistory) && traits.medicalHistory.length) {
        context += `- 医疗史：${traits.medicalHistory.join('、')}\n`;
      }
    }

    return context;
  } catch (error) {
    console.error('获取用户上下文失败:', error);
    return '';
  }
}

function buildSystemPrompt(isChildScale: boolean) {
  if (isChildScale) {
    return `你是一位专业的儿童心理评估师和儿童发展专家。你的任务是根据评估结果，为家长提供专业、温暖、个性化的建议和指导。

请遵循以下原则：
1. 专业准确：基于评估数据和儿童发展理论
2. 温暖共情：理解家长的关切，给予情感支持
3. 个性化：根据孩子特点和评估结果定制建议
4. 可操作性：提供具体、可执行的建议
5. 积极正向：关注孩子的优势和潜力
6. 不夸大结论：量表结果仅作辅助参考，不替代诊断

建议应包含以下部分：
1. 评估解读
2. 优势发现
3. 关注领域
4. 具体建议
5. 家庭活动
6. 专业支持
7. 鼓励话语`;
  }

  return `你是一位专业、谨慎、富有同理心的医学与心理健康评估顾问。你的任务是根据量表结果，为患者或陪诊者提供结构清晰、可执行、不过度诊断的建议。

请遵循以下原则：
1. 只做结果解读和健康建议，不替代临床诊断
2. 明确提示需要结合门诊评估、复诊和医生判断
3. 建议务必具体、克制、可执行
4. 语气温和、尊重隐私、避免惊吓式表达
5. 当量表未提供分级阈值时，不擅自推断疾病严重程度

建议应包含以下部分：
1. 结果解读
2. 当前重点关注
3. 日常管理建议
4. 就医与复测建议
5. 鼓励与提醒`;
}

function buildUserPrompt(result: AssessmentResultPayload, subjectContext: string, isChildScale: boolean) {
  const scoreLabel = typeof result.details?.scoreLabel === 'string' ? result.details.scoreLabel : '总分';
  const scoreDisplay =
    typeof result.details?.scoreDisplay === 'string' ? result.details.scoreDisplay : `${result.totalScore}分`;
  const totalScoreLabel =
    typeof result.details?.totalScoreLabel === 'string' ? result.details.totalScoreLabel : '总分';
  const totalScoreHint =
    typeof result.details?.totalScoreHint === 'string' ? result.details.totalScoreHint : '';
  const numericScoreLine = `- ${totalScoreLabel}：${result.totalScore}`;
  const dimensionLines = Array.isArray(result.details?.dimensionResults)
    ? result.details.dimensionResults
        .map((dimension) => `- ${dimension.label}：${dimension.displayValue || `${dimension.score}分`}`)
        .join('\n')
    : '';

  return `${subjectContext}
评估结果：
- 量表名称：${result.scaleName}
- ${scoreLabel}：${scoreDisplay}
${scoreLabel === totalScoreLabel ? '' : numericScoreLine}
- 评估结论：${result.conclusion}
${dimensionLines ? `${dimensionLines}\n` : ''}${result.details?.description ? `- 详细说明：${result.details.description}\n` : ''}${totalScoreHint ? `- 结果说明：${totalScoreHint}\n` : ''}
请根据以上信息，生成个性化建议。注意：
- ${isChildScale ? '如果结果正常，重点说明如何保持和促进儿童发展。' : '如果结果未提供分级阈值，不要自行追加严重程度判断。'}
- ${isChildScale ? '如果结果显示需要关注，给出家庭支持和就医建议。' : '如果存在功能影响或症状负担，请提醒结合门诊评估与复诊。'}
- ${isChildScale ? '语言面向家长。' : '语言面向患者本人或陪诊者。'}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, result }: { deviceId: string; result: AssessmentResultPayload } = body;

    if (!deviceId || !result) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    let apiKey: string;
    let provider: string;
    let endpoint: string;
    let model: string;

    try {
      const keyData = await getSystemApiKey();
      apiKey = keyData.key;
      provider = keyData.provider;
      endpoint = keyData.endpoint;
      model = keyData.model;
    } catch (error) {
      console.error('[Generate Advice] Failed to get API key:', error);
      return NextResponse.json({ error: '系统未配置 AI 服务，请在后台添加 API Key' }, { status: 500 });
    }

    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: '无效的 AI 服务商配置' }, { status: 500 });
    }

    const scale = getScaleDefinitionById(result.scaleId);
    const isChildScale = scale?.category === 'Child Development';
    const structuredPatientInfo = buildStructuredPatientInfo(result, isChildScale);
    const profileContext = structuredPatientInfo ? '' : await buildProfileContext(deviceId, isChildScale);
    const subjectContext = `${structuredPatientInfo}${profileContext}`.trim();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(isChildScale) },
          { role: 'user', content: buildUserPrompt(result, subjectContext, isChildScale) },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Generate Advice] AI API error:', response.status, errorText);

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

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const data = await response.json();
    const advice = data.choices?.[0]?.message?.content || '无法生成建议';

    return NextResponse.json({
      success: true,
      advice,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Generate Advice Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成建议失败，请稍后重试' },
      { status: 500 }
    );
  }
}
