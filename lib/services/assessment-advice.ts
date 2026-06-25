import { getAgentWorkspaceConfig } from '@/lib/agent/config';
import { prisma } from '@/lib/db/prisma';
import { getSerializableScaleById } from '@/lib/scales/catalog';
import { getSystemApiKey } from '@/lib/services/apiKeyService';
import { PROVIDER_CONFIGS } from '@/lib/services/apiKeyProviderConfig';

export interface AssessmentAnalysisInput {
  result: {
    scaleId: string;
    scaleName?: string;
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      [key: string]: unknown;
    };
  };
  language?: 'zh' | 'en';
  profileId?: string;
  deviceId?: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  provider?: string;
  timeoutMs?: number;
  mode?: 'generic' | 'doctor_bot';
  assistantName?: string;
}

export interface AssessmentAnalysisOutput {
  advice: string;
  language: 'zh' | 'en';
  generatedAt: string;
  model?: string | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  provider?: string;
}

type AdviceLanguage = 'zh' | 'en';

type ChatCompletionResponse = {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_ADVICE_TIMEOUT_MS = 25_000;

function resolveLanguage(input?: string): AdviceLanguage {
  return input === 'en' ? 'en' : 'zh';
}

function resolveScaleName(result: AssessmentAnalysisInput['result'], language: AdviceLanguage) {
  if (result.scaleName?.trim()) {
    return result.scaleName.trim();
  }

  const scale = getSerializableScaleById(result.scaleId);
  if (!scale) {
    return result.scaleId;
  }

  if (typeof scale.title === 'string') {
    return scale.title;
  }

  return language === 'en' ? scale.title.en || scale.title.zh : scale.title.zh;
}

function summarizeUnknownValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => summarizeUnknownValue(item))
      .filter(Boolean)
      .join(' / ');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '';
}

function buildResultDetailsSummary(
  details: AssessmentAnalysisInput['result']['details'],
  language: AdviceLanguage
) {
  if (!details) {
    return '';
  }

  const lines = Object.entries(details)
    .filter(([key]) => key !== 'description')
    .map(([key, value]) => `- ${key}: ${summarizeUnknownValue(value)}`)
    .filter((line) => !line.endsWith(': '));

  if (!lines.length) {
    return '';
  }

  return language === 'en'
    ? `Detailed fields:\n${lines.join('\n')}`
    : `详细字段：\n${lines.join('\n')}`;
}

function buildFallbackProfileSummary(profile: any, language: AdviceLanguage) {
  if (!profile) {
    return '';
  }

  const traits = (profile.traits as Record<string, unknown> | null) || {};
  const interests = Array.isArray(traits.interests) ? traits.interests : [];
  const fears = Array.isArray(traits.fears) ? traits.fears : [];
  const behaviors = Array.isArray(traits.behaviors) ? traits.behaviors : [];
  const medicalHistory = Array.isArray(traits.medicalHistory) ? traits.medicalHistory : [];

  if (language === 'en') {
    return [
      'Subject Information:',
      `- Name: ${profile.nickname}`,
      `- Gender: ${profile.gender === 'boy' ? 'Boy' : profile.gender === 'girl' ? 'Girl' : String(profile.gender || 'Unknown')}`,
      profile.ageMonths ? `- Age in months: ${profile.ageMonths}` : '',
      interests.length ? `- Interests: ${interests.join(', ')}` : '',
      fears.length ? `- Current concerns: ${fears.join(', ')}` : '',
      behaviors.length ? `- Behavioral traits: ${behaviors.join(', ')}` : '',
      medicalHistory.length ? `- Medical history: ${medicalHistory.join(', ')}` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    '受测对象信息：',
    `- 称呼：${profile.nickname}`,
    `- 性别：${profile.gender === 'boy' ? '男孩' : profile.gender === 'girl' ? '女孩' : String(profile.gender || '未知')}`,
    profile.ageMonths ? `- 月龄：${profile.ageMonths}个月` : '',
    interests.length ? `- 兴趣偏好：${interests.join('、')}` : '',
    fears.length ? `- 当前担心：${fears.join('、')}` : '',
    behaviors.length ? `- 行为特点：${behaviors.join('、')}` : '',
    medicalHistory.length ? `- 医疗史：${medicalHistory.join('、')}` : '',
  ].filter(Boolean).join('\n');
}

async function loadProfileContext(input: {
  deviceId?: string;
  profileId?: string;
}) {
  if (input.profileId) {
    const profile = await prisma.memberProfile.findUnique({
      where: { id: input.profileId },
    });
    if (profile) {
      return profile;
    }
  }

  if (!input.deviceId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { deviceId: input.deviceId },
    include: {
      profiles: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return user?.profiles?.[0] || null;
}

function buildUserPrompt(input: {
  language: AdviceLanguage;
  result: AssessmentAnalysisInput['result'];
  profileSummary: string;
  mode: 'generic' | 'doctor_bot';
}) {
  const scaleName = resolveScaleName(input.result, input.language);
  const scoreLabel =
    typeof input.result.details?.scoreLabel === 'string'
      ? input.result.details.scoreLabel
      : input.language === 'en'
        ? 'Score'
        : '总分';
  const scoreDisplay =
    typeof input.result.details?.scoreDisplay === 'string'
      ? input.result.details.scoreDisplay
      : input.language === 'en'
        ? `${input.result.totalScore} pts`
        : `${input.result.totalScore}分`;
  const totalScoreLabel =
    typeof input.result.details?.totalScoreLabel === 'string'
      ? input.result.details.totalScoreLabel
      : input.language === 'en'
        ? 'Total Score'
        : '总分';
  const totalScoreHint =
    typeof input.result.details?.totalScoreHint === 'string'
      ? input.result.details.totalScoreHint
      : '';
  const detailsSummary = buildResultDetailsSummary(input.result.details, input.language);

  if (input.mode === 'doctor_bot') {
    if (input.language === 'en') {
      return `${input.profileSummary}

Assessment Result:
- Scale Name: ${scaleName}
- ${scoreLabel}: ${scoreDisplay}
- ${totalScoreLabel}: ${input.result.totalScore}
- Conclusion: ${input.result.conclusion}
${input.result.details?.description ? `- Detail: ${input.result.details.description}` : ''}
${totalScoreHint ? `- Result Note: ${totalScoreHint}` : ''}
${detailsSummary}

Please continue the conversation naturally based on this result. Explain the conclusion briefly and give only a small number of practical next-step suggestions. Do not recalculate the score. Do not write a long report.`;
    }

    return `${input.profileSummary}

评估结果：
- 量表名称：${scaleName}
- ${scoreLabel}：${scoreDisplay}
- ${totalScoreLabel}：${input.result.totalScore}
- 评估结论：${input.result.conclusion}
${input.result.details?.description ? `- 详细说明：${input.result.details.description}` : ''}
${totalScoreHint ? `- 结果说明：${totalScoreHint}` : ''}
${detailsSummary}

请基于这份结果自然地继续对话，简短解释结论，并补充少量下一步建议。不要重新计算分数，不要写成长报告，也不要用过多标题和分节。`;
  }

  if (input.language === 'en') {
    return `${input.profileSummary}

Assessment Result:
- Scale Name: ${scaleName}
- ${scoreLabel}: ${scoreDisplay}
- ${totalScoreLabel}: ${input.result.totalScore}
- Conclusion: ${input.result.conclusion}
${input.result.details?.description ? `- Detail: ${input.result.details.description}` : ''}
${totalScoreHint ? `- Result Note: ${totalScoreHint}` : ''}
${detailsSummary}

Please explain this assessment result clearly for the patient or caregiver in English. Include:
1. What this result means
2. Main watch-outs or risks
3. 2 to 5 practical next-step suggestions
4. Whether a follow-up assessment or doctor visit should be considered

Do not recalculate the score. Use the result as the source of truth.`;
  }

  return `${input.profileSummary}

评估结果：
- 量表名称：${scaleName}
- ${scoreLabel}：${scoreDisplay}
- ${totalScoreLabel}：${input.result.totalScore}
- 评估结论：${input.result.conclusion}
${input.result.details?.description ? `- 详细说明：${input.result.details.description}` : ''}
${totalScoreHint ? `- 结果说明：${totalScoreHint}` : ''}
${detailsSummary}

请基于这份量表结果，为患者或家属生成自然语言解释。内容需包括：
1. 这份结果说明了什么
2. 当前最值得关注的点
3. 2 到 5 条可执行建议
4. 是否建议继续做其他量表或联系医生

不要重新计算分数，直接把当前结果视为唯一事实来源。`;
}

function buildSystemPrompt(input: {
  language: AdviceLanguage;
  mode: 'generic' | 'doctor_bot';
  assistantName?: string;
  genericPromptZh: string;
  genericPromptEn: string;
}) {
  if (input.mode === 'doctor_bot') {
    if (input.language === 'en') {
      return `You are continuing a live doctor assistant conversation${input.assistantName ? ` as ${input.assistantName}` : ''}. Keep the tone natural, brief, warm, and conversational. Use the provided assessment result as the only source of truth. Do not recalculate scores. Do not invent data. Avoid long report formatting unless absolutely necessary.`;
    }

    return `你正在继续一段医生分身对话${input.assistantName ? `，当前身份是 ${input.assistantName}` : ''}。请保持自然、简短、温和、口语化的表达。只把给定量表结果当作唯一事实来源，不要重算分数，不要编造未提供的数据，除非非常必要，不要写成长报告。`;
  }

  return input.language === 'en'
    ? input.genericPromptEn
    : input.genericPromptZh;
}

async function resolveAiConfig(input: AssessmentAnalysisInput) {
  if (input.endpoint && input.apiKey) {
    return {
      endpoint: input.endpoint,
      apiKey: input.apiKey,
      model: input.model,
      provider: input.provider || 'FastGPT',
    };
  }

  const keyData = await getSystemApiKey();
  const providerConfig = PROVIDER_CONFIGS[keyData.provider];

  return {
    endpoint: keyData.endpoint,
    apiKey: keyData.key,
    model: keyData.model,
    provider: providerConfig?.name || keyData.provider,
  };
}

export async function analyzeCompletedAssessmentResult(
  input: AssessmentAnalysisInput
): Promise<AssessmentAnalysisOutput> {
  const language = resolveLanguage(input.language);
  const mode = input.mode || 'generic';
  const agentConfig = await getAgentWorkspaceConfig();
  const systemPrompt = buildSystemPrompt({
    language,
    mode,
    assistantName: input.assistantName,
    genericPromptZh: agentConfig.prompts.assessmentAdviceSystemZh,
    genericPromptEn: agentConfig.prompts.assessmentAdviceSystemEn,
  });

  const profile = await loadProfileContext({
    deviceId: input.deviceId,
    profileId: input.profileId,
  });
  const profileSummary = buildFallbackProfileSummary(profile, language);
  const userPrompt = buildUserPrompt({
    language,
    result: input.result,
    profileSummary,
    mode,
  });
  const ai = await resolveAiConfig(input);

  const response = await fetch(ai.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`,
    },
    signal: AbortSignal.timeout(input.timeoutMs || DEFAULT_ADVICE_TIMEOUT_MS),
    body: JSON.stringify({
      ...(ai.model ? { model: ai.model } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  const rawText = await response.text();
  let payload: ChatCompletionResponse = {};
  try {
    payload = rawText ? (JSON.parse(rawText) as ChatCompletionResponse) : {};
  } catch {
    if (!response.ok) {
      throw new Error(rawText || `${ai.provider} 请求失败（HTTP ${response.status}）`);
    }
    throw new Error(`${ai.provider} 返回了无法识别的响应格式`);
  }

  if (!response.ok) {
    const providerName = ai.provider || 'AI';
    let errorMessage = payload.error?.message || rawText || `${providerName} 请求失败`;

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      errorMessage =
        language === 'en'
          ? `${providerName} is temporarily unavailable. Please retry later.`
          : `${providerName} 服务暂时不可用，请稍后重试。`;
    } else if (response.status === 401 || response.status === 403) {
      errorMessage =
        language === 'en'
          ? `The ${providerName} API key is invalid or expired.`
          : `${providerName} API Key 无效或已过期。`;
    } else if (response.status === 429) {
      errorMessage =
        language === 'en'
          ? `${providerName} rate limit was exceeded. Please retry later.`
          : `${providerName} 调用频率超限，请稍后重试。`;
    } else if (response.status === 402 || rawText.includes('insufficient')) {
      errorMessage =
        language === 'en'
          ? `${providerName} account balance is insufficient.`
          : `${providerName} 账户余额不足，请充值后重试。`;
    }

    throw new Error(errorMessage);
  }

  const advice =
    payload.choices?.[0]?.message?.content?.trim() ||
    (language === 'en' ? 'Unable to generate advice.' : '无法生成建议。');

  return {
    advice,
    language,
    generatedAt: new Date().toISOString(),
    model: payload.model || ai.model || null,
    usage: payload.usage,
    provider: ai.provider,
  };
}
