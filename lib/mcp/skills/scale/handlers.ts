import { prisma } from '@/lib/db/prisma';
import {
  createAssessmentSessionForDevice,
  confirmMappedScaleAnswer,
  evaluateSkillScale,
  generateAssessmentLinkForDevice,
  getAssessmentSessionForDevice,
  getAssessmentSessionResultForDevice,
  getSkillScale,
  listSkillScales,
  mapNaturalLanguageScaleAnswer,
  pauseAssessmentSessionForDevice,
  resumeAssessmentSessionForDevice,
  submitAssessmentAnswerForDevice,
  cancelAssessmentSessionForDevice,
} from '@/lib/assessment-skill/scale-service';
import { ensureMemberForDevice } from '@/lib/assessment-skill/member-service';
import {
  dispatchAssessmentCompletionCallback,
  getAssessmentCompletionCallbackStatus,
  registerAssessmentCompletionCallback,
} from '@/lib/services/assessment-callbacks';
import {
  evaluateScaleAnswers,
  getScaleDefinitionById,
  isRespondentResultVisible,
  listPublicClinicalChildScales,
  resolveScaleResultDeliveryMode,
} from '@/lib/scales/catalog';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

async function getDefaultDailyLimit(): Promise<number> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: 'defaultDailyLimit' },
    });

    return config ? parseInt(config.configValue, 10) : 10;
  } catch (error) {
    console.error('[Get Default Limit Error]:', error);
    return 10;
  }
}

function estimateScaleTime(questionCount: number, estimatedMinutes?: number): string {
  if (estimatedMinutes && estimatedMinutes > 0) {
    return `${estimatedMinutes}分钟`;
  }

  if (questionCount <= 20) return '5分钟';
  if (questionCount <= 40) return '8分钟';
  if (questionCount <= 60) return '12分钟';
  return '15分钟';
}

const symptomKeywords: Record<string, string[]> = {
  ABC: ['社交', '不理人', '重复动作', '刻板', '眼神', '自闭'],
  CARS: ['诊断', '严重程度', '模仿', '情感反应', '感官'],
  M_CHAT_R: ['不会指', '不看人', '叫名没反应', '假装游戏', '共同注意'],
  SRS: ['社交困难', '同伴关系', '眼神接触', '不合群'],
  'SNAP-IV': ['注意力', '多动', '坐不住', '冲动'],
};

const listSupportedScalesTool = {
  name: 'list_supported_scales',
  description: '列出可用儿童临床量表，包含授权与结果交付状态投影',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
} as const;

const getScaleSchemaTool = {
  name: 'get_scale_schema',
  description: '获取指定量表 schema、题目版本、语言和授权状态',
  inputSchema: {
    type: 'object',
    properties: {
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
    },
    required: ['scaleId'],
  },
} as const;

const mapNaturalLanguageAnswerTool = {
  name: 'map_natural_language_answer',
  description: '将自然语言答案映射为候选分值；低置信度必须确认后才能提交',
  inputSchema: {
    type: 'object',
    properties: {
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      questionId: {
        type: 'number',
        description: '题目 ID',
      },
      text: {
        type: 'string',
        description: '用户自然语言回答',
      },
      language: {
        type: 'string',
        description: '语言，可选 zh/en',
      },
    },
    required: ['scaleId', 'questionId', 'text'],
  },
} as const;

const confirmMappedAnswerTool = {
  name: 'confirm_mapped_answer',
  description: '确认自然语言映射候选，返回可提交的结构化答案',
  inputSchema: {
    type: 'object',
    properties: {
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      questionId: {
        type: 'number',
        description: '题目 ID',
      },
      score: {
        type: 'number',
        description: '用户确认的分值',
      },
      confidence: {
        type: 'number',
        description: '原映射置信度，可选',
      },
      evidence: {
        type: 'string',
        description: '原映射证据，可选',
      },
    },
    required: ['scaleId', 'questionId', 'score'],
  },
} as const;

const scoreAssessmentTool = {
  name: 'score_assessment',
  description: '只使用本地确定性评分引擎计算量表结果，不持久化',
  inputSchema: {
    type: 'object',
    properties: {
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      answers: {
        type: 'array',
        items: { type: 'number' },
        description: '按题目顺序排列的答案分值',
      },
    },
    required: ['scaleId', 'answers'],
  },
} as const;

const recommendScaleTool = {
  name: 'recommend_scale',
  description: '根据症状关键词推荐量表',
  inputSchema: {
    type: 'object',
    properties: {
      symptoms: {
        type: 'string',
        description: '逗号分隔的症状摘要',
      },
    },
    required: ['symptoms'],
  },
} as const;

const recommendAssessmentTool = {
  name: 'recommend_assessment',
  description: '根据症状关键词推荐进入哪种评估（量表或生长曲线）',
  inputSchema: {
    type: 'object',
    properties: {
      symptoms: {
        type: 'string',
        description: '逗号分隔的症状摘要',
      },
    },
    required: ['symptoms'],
  },
} as const;

const callbackRegistrationProperties = {
  callbackUrl: {
    type: 'string',
    description: 'Optional webhook URL. If provided, the project will POST the final assessment result after submission.',
  },
  callbackSecret: {
    type: 'string',
    description: 'Optional HMAC secret used to sign callback payloads.',
  },
  callbackMetadata: {
    type: 'object',
    description: 'Optional metadata echoed back in the callback payload.',
  },
} as const;

const getScaleQuestionsTool = {
  name: 'get_scale_questions',
  description: '获取指定量表的题目与选项',
  inputSchema: {
    type: 'object',
    properties: {
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      offset: {
        type: 'number',
        description: '起始偏移量',
      },
      limit: {
        type: 'number',
        description: '分页大小',
      },
    },
    required: ['scaleId'],
  },
} as const;

const createAssessmentSessionTool = {
  name: 'create_assessment_session',
  description: '创建或恢复量表评估会话',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID 或外部智能体会话 ID。对 FastGPT 这类外部智能体，可传一个稳定的 external_session_id。',
      },
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      memberId: {
        type: 'string',
        description: '成员 ID，可选',
      },
      language: {
        type: 'string',
        description: '语言，可选 zh/en',
      },
      memberSnapshot: {
        type: 'object',
        description: '若设备尚无成员档案，可传入临时受测对象信息。未传时系统会自动创建一个临时受测对象。',
        properties: {
          nickname: { type: 'string', description: '受测对象昵称，例如：小朋友、本人、儿童1号' },
          gender: { type: 'string', description: '建议传 boy / girl / unknown' },
          ageMonths: { type: 'number', description: '月龄，可选' },
          relation: { type: 'string', description: '关系，默认 SELF' },
          languagePreference: { type: 'string', description: 'ZH 或 EN' },
        },
      },
      ...callbackRegistrationProperties,
    },
    required: ['deviceId', 'scaleId'],
  },
} as const;

const generateAssessmentLinkTool = {
  name: 'generate_assessment_link',
  description: 'Create a web handoff link for scales that must be completed in a public form',
  inputSchema: createAssessmentSessionTool.inputSchema,
} as const;

const getCurrentQuestionTool = {
  name: 'get_current_question',
  description: '获取当前评估会话的当前题目',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      sessionId: {
        type: 'string',
        description: '评估会话 ID',
      },
    },
    required: ['deviceId', 'sessionId'],
  },
} as const;

const submitAnswerTool = {
  name: 'submit_answer',
  description: '提交当前题答案并推进到下一题',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      sessionId: {
        type: 'string',
        description: '评估会话 ID',
      },
      questionId: {
        type: 'number',
        description: '当前题目 ID',
      },
      score: {
        type: 'number',
        description: '当前题分值',
      },
    },
    required: ['deviceId', 'sessionId', 'questionId', 'score'],
  },
} as const;

const getAssessmentResultTool = {
  name: 'get_assessment_result',
  description: '获取评估会话当前结果或最终结果',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      sessionId: {
        type: 'string',
        description: '评估会话 ID',
      },
    },
    required: ['deviceId', 'sessionId'],
  },
} as const;

const pauseAssessmentSessionTool = {
  name: 'pause_assessment_session',
  description: '暂停评估会话',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      sessionId: {
        type: 'string',
        description: '评估会话 ID',
      },
    },
    required: ['deviceId', 'sessionId'],
  },
} as const;

const resumeAssessmentSessionTool = {
  name: 'resume_assessment_session',
  description: '恢复已暂停的评估会话',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      sessionId: {
        type: 'string',
        description: '评估会话 ID',
      },
    },
    required: ['deviceId', 'sessionId'],
  },
} as const;

const cancelAssessmentSessionTool = {
  name: 'cancel_assessment_session',
  description: '取消评估会话',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      sessionId: {
        type: 'string',
        description: '评估会话 ID',
      },
    },
    required: ['deviceId', 'sessionId'],
  },
} as const;

const submitAndEvaluateTool = {
  name: 'submit_and_evaluate',
  description: '使用本地确定性评分引擎直接计算结果（legacy）',
  inputSchema: {
    type: 'object',
    properties: {
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      answers: {
        type: 'array',
        items: { type: 'number' },
        description: '按题目顺序排列的答案分值',
      },
    },
    required: ['scaleId', 'answers'],
  },
} as const;

const listScalesTool = {
  name: 'list_scales',
  description: '获取平台可用量表列表（legacy）',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
} as const;

const submitAssessmentTool = {
  name: 'submit_assessment',
  description: '提交整份量表并返回评估结果（legacy）',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: '设备 ID',
      },
      scaleId: {
        type: 'string',
        description: '量表 ID',
      },
      memberId: {
        type: 'string',
        description: '成员 ID，可选',
      },
      language: {
        type: 'string',
        description: '语言，可选：zh / en',
      },
      memberSnapshot: {
        type: 'object',
        description: '若设备尚无成员档案，可传入临时受测对象信息；未传时系统会自动创建。',
      },
      answers: {
        type: 'array',
        items: { type: 'number' },
        description: '用户答案分值数组',
      },
    },
    required: ['deviceId', 'scaleId', 'answers'],
  },
} as const;

export const canonicalScaleTools = [
  listSupportedScalesTool,
  getScaleSchemaTool,
  mapNaturalLanguageAnswerTool,
  confirmMappedAnswerTool,
  scoreAssessmentTool,
  recommendAssessmentTool,
  recommendScaleTool,
  getScaleQuestionsTool,
  createAssessmentSessionTool,
  generateAssessmentLinkTool,
  getCurrentQuestionTool,
  submitAnswerTool,
  getAssessmentResultTool,
  pauseAssessmentSessionTool,
  resumeAssessmentSessionTool,
  cancelAssessmentSessionTool,
  submitAndEvaluateTool,
] as const;

export const scaleTools = [
  ...canonicalScaleTools,
  listScalesTool,
  submitAssessmentTool,
] as const;

type DeviceAssessmentSession = Awaited<ReturnType<typeof createAssessmentSessionForDevice>>;

function buildQrCodeUrl(content: string, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}`;
}

function buildHandoffPayload(session: DeviceAssessmentSession) {
  if (!session.handoff?.url) {
    return null;
  }

  return {
    url: session.handoff.url,
    expiresAt: session.handoff.expiresAt,
    qrCodeUrl: buildQrCodeUrl(session.handoff.url),
    qrCodeAlt: 'Assessment handoff QR code',
  };
}

function buildCompletionPayload(session: DeviceAssessmentSession) {
  const hasFinalResult = Boolean(session.result) && session.status === 'COMPLETED';
  const terminatedWithoutResult = session.status === 'CANCELLED' || session.status === 'EXPIRED';
  const pending = !hasFinalResult && !terminatedWithoutResult;

  return {
    status: hasFinalResult ? 'completed' : terminatedWithoutResult ? 'closed' : 'pending',
    hasFinalResult,
    shouldPollResult: pending,
    pollAfterSeconds: pending ? 8 : null,
  };
}

function buildFastGptNextAction(args: any, session: DeviceAssessmentSession) {
  return {
    tool: 'get_assessment_result',
    args: {
      deviceId: String(args?.deviceId || ''),
      sessionId: session.sessionId,
    },
    when: 'after_user_finishes_handoff_form',
  };
}

async function maybeRegisterCallback(args: any, session: DeviceAssessmentSession) {
  if (typeof args?.callbackUrl !== 'string' || !args.callbackUrl.trim()) {
    return null;
  }

  await registerAssessmentCompletionCallback({
    assessmentSessionId: session.sessionId,
    deviceId: typeof args?.deviceId === 'string' ? args.deviceId : undefined,
    callbackUrl: args.callbackUrl,
    callbackSecret: typeof args?.callbackSecret === 'string' ? args.callbackSecret : undefined,
    callbackMetadata:
      args?.callbackMetadata && typeof args.callbackMetadata === 'object'
        ? args.callbackMetadata
        : undefined,
  });

  return getAssessmentCompletionCallbackStatus(session.sessionId);
}

function parseConflict(error: unknown) {
  if (error instanceof Error && 'statusCode' in error) {
    return {
      success: false,
      error: error.message,
      code: (error as { code?: string }).code,
      statusCode: (error as { statusCode: number }).statusCode,
      ...(error && typeof error === 'object' && 'data' in error ? { data: (error as { data?: unknown }).data } : {}),
    };
  }

  return null;
}

async function listScales() {
  const scales = listSkillScales().map((scale) => ({
    id: scale.id,
    title: resolveLocalizedText(scale.title, 'zh'),
    description: resolveLocalizedText(scale.description, 'zh'),
    questionCount: scale.questions.length,
    estimatedTime: estimateScaleTime(scale.questions.length, scale.estimatedMinutes),
    category: scale.category,
    source: scale.source || 'builtin',
    tags: scale.tags || [],
    status: scale.status || 'active',
    licenseStatus: 'UNKNOWN',
    commercialEnabled: false,
    resultDeliveryMode: resolveScaleResultDeliveryMode(scale),
    resultVisibleToRespondent: isRespondentResultVisible(scale),
  }));

  return {
    success: true,
    totalCount: scales.length,
    scales,
  };
}

async function getScaleSchema(input: { scaleId: string }) {
  const scale = getScaleDefinitionById(input.scaleId);

  if (!scale) {
    const availableScaleIds = listPublicClinicalChildScales().map((item) => item.id).join(', ');
    return {
      success: false,
      error: `量表 ${input.scaleId} 不存在，可用量表：${availableScaleIds}`,
      statusCode: 404,
    };
  }

  return {
    success: true,
    scale: {
      id: scale.id,
      version: scale.version || '1.0',
      title: resolveLocalizedText(scale.title, 'zh'),
      description: resolveLocalizedText(scale.description, 'zh'),
      questionCount: scale.questions.length,
      supportedLanguages: scale.supportedLanguages || ['zh'],
      status: scale.status || 'active',
      licenseStatus: 'UNKNOWN',
      commercialEnabled: false,
      resultDeliveryMode: resolveScaleResultDeliveryMode(scale),
      resultVisibleToRespondent: isRespondentResultVisible(scale),
      doctorReviewRequired: resolveScaleResultDeliveryMode(scale) === 'physician_review',
      questions: scale.questions.map((question) => ({
        questionId: question.id,
        question: resolveLocalizedText(question.text, 'zh'),
        colloquial: resolveLocalizedText(question.colloquial, 'zh'),
        confirmationPrompt: resolveLocalizedText(question.confirmationPrompt, 'zh'),
        riskLevel: question.riskLevel || 'normal',
        options: question.options.map((option) => ({
          label: option.label,
          score: option.score,
          aliases: option.aliases ?? [],
          description: resolveLocalizedText(option.description, 'zh'),
        })),
      })),
    },
  };
}

function validateScoreAnswers(scale: NonNullable<ReturnType<typeof getScaleDefinitionById>>, answers: unknown) {
  if (!Array.isArray(answers) || answers.length !== scale.questions.length) {
    return {
      error: `Expected ${scale.questions.length} answers, received ${Array.isArray(answers) ? answers.length : 0}`,
      answers: null,
    };
  }

  const normalizedAnswers: number[] = [];
  for (let index = 0; index < answers.length; index += 1) {
    const score = Number(answers[index]);
    const question = scale.questions[index];
    if (!Number.isFinite(score) || !question.options.some((option) => option.score === score)) {
      return {
        error: `Score ${answers[index]} is not valid for question ${question.id}`,
        answers: null,
      };
    }
    normalizedAnswers.push(score);
  }

  return {
    error: null,
    answers: normalizedAnswers,
  };
}

async function scoreAssessment(input: { scaleId: string; answers: unknown }) {
  const scale = getScaleDefinitionById(input.scaleId);
  if (!scale) {
    return {
      success: false,
      error: `Scale "${input.scaleId}" not found`,
      statusCode: 404,
    };
  }

  const normalized = validateScoreAnswers(scale, input.answers);
  if (!normalized.answers) {
    return {
      success: false,
      error: normalized.error,
      statusCode: 400,
    };
  }

  const resultVisibleToRespondent = isRespondentResultVisible(scale);
  const resultDeliveryMode = resolveScaleResultDeliveryMode(scale);

  return {
    success: true,
    resultDeliveryMode,
    resultVisibleToRespondent,
    result: evaluateScaleAnswers(scale.id, normalized.answers),
  };
}

async function recommendScale(symptoms: string) {
  const availableScales = listPublicClinicalChildScales();
  const matchedScales = availableScales.filter((scale) => {
    const keywords = symptomKeywords[scale.id] || [];
    return keywords.some((keyword) => symptoms.includes(keyword));
  });

  const recommendations = matchedScales.length > 0
    ? matchedScales
    : availableScales.filter((scale) => scale.id === 'ABC').slice(0, 1);

  return recommendations.map((scale) => ({
    id: scale.id,
    title: resolveLocalizedText(scale.title, 'zh'),
    description: resolveLocalizedText(scale.description, 'zh'),
  }));
}

async function getScaleQuestions(input: { scaleId: string; offset?: number; limit?: number }) {
  const scale = getScaleDefinitionById(input.scaleId);

  if (!scale) {
    const availableScaleIds = listPublicClinicalChildScales().map((item) => item.id).join(', ');
    return {
      success: false,
      error: `量表 ${input.scaleId} 不存在，可用量表：${availableScaleIds}`,
      statusCode: 404,
    };
  }

  const offset = input.offset ?? 0;
  const limit = input.limit ?? 5;
  const pagedQuestions = scale.questions.slice(offset, offset + limit);
  const hasMore = offset + limit < scale.questions.length;

  return {
    success: true,
    scaleId: scale.id,
    scaleTitle: resolveLocalizedText(scale.title, 'zh'),
    total: scale.questions.length,
    hasMore,
    questions: pagedQuestions.map((question, index) => ({
      index: offset + index + 1,
      questionId: question.id,
      question: resolveLocalizedText(question.text, 'zh'),
      colloquial: resolveLocalizedText(question.colloquial, 'zh'),
      options: question.options.map((option) => ({
        label: option.label,
        score: option.score,
        aliases: option.aliases ?? [],
        description: resolveLocalizedText(option.description, 'zh'),
      })),
    })),
  };
}

async function submitAssessmentLegacy(input: {
  deviceId: string;
  scaleId: string;
  memberId?: string;
  answers: number[];
  language?: 'zh' | 'en';
  memberSnapshot?: {
    nickname?: string;
    gender?: string;
    ageMonths?: number;
    relation?: string;
    languagePreference?: string;
    interests?: string[];
    fears?: string[];
    avatarConfig?: unknown;
  };
}) {
  const scale = getScaleDefinitionById(input.scaleId);
  if (!scale) {
    return {
      success: false,
      error: `量表 ${input.scaleId} 不存在`,
      statusCode: 404,
    };
  }

  if (!Array.isArray(input.answers) || input.answers.length !== scale.questions.length) {
    return {
      success: false,
      error: `答案数量不匹配，需要 ${scale.questions.length} 个答案，实际 ${Array.isArray(input.answers) ? input.answers.length : 0} 个`,
      statusCode: 400,
    };
  }

  const { user, member } = await ensureMemberForDevice({
    deviceId: input.deviceId,
    memberId: input.memberId,
    memberSnapshot: {
      nickname:
        input.memberSnapshot?.nickname?.trim() ||
        (input.language === 'en' ? 'Temporary Subject' : '临时受测对象'),
      gender: input.memberSnapshot?.gender?.trim() || 'unknown',
      ageMonths: input.memberSnapshot?.ageMonths,
      relation: input.memberSnapshot?.relation || 'SELF',
      languagePreference:
        input.memberSnapshot?.languagePreference || (input.language === 'en' ? 'EN' : 'ZH'),
      interests: input.memberSnapshot?.interests || [],
      fears: input.memberSnapshot?.fears || [],
      avatarConfig: input.memberSnapshot?.avatarConfig,
    },
  });

  const evaluation = await evaluateSkillScale({
    userId: user.id,
    profileId: member.id,
    scaleId: input.scaleId,
    answers: input.answers,
  });
  const resultVisibleToRespondent = isRespondentResultVisible(scale);
  const resultDeliveryMode = resolveScaleResultDeliveryMode(scale);

  return {
    success: true,
    assessmentId: evaluation.assessmentId,
    scaleId: evaluation.scaleId,
    resultDeliveryMode,
    resultVisibleToRespondent,
    result: evaluation.result,
    evaluatedAt: evaluation.createdAt,
    message: '评估完成并已保存',
  };
}

export async function handleScaleToolCall(name: string, args: any) {
  try {
    switch (name) {
      case 'list_scales':
      case 'list_supported_scales':
        return await listScales();

      case 'get_scale_schema':
        return await getScaleSchema({
          scaleId: String(args?.scaleId || ''),
        });

      case 'recommend_scale':
      case 'recommend_assessment':
        return {
          success: true,
          recommendations: await recommendScale(String(args?.symptoms || '')),
        };

      case 'get_scale_questions':
        return await getScaleQuestions({
          scaleId: String(args?.scaleId || ''),
          offset: typeof args?.offset === 'number' ? args.offset : undefined,
          limit: typeof args?.limit === 'number' ? args.limit : undefined,
        });

      case 'map_natural_language_answer': {
        const mapping = mapNaturalLanguageScaleAnswer({
          scaleId: String(args?.scaleId || ''),
          questionId: Number(args?.questionId),
          text: String(args?.text || ''),
          language: args?.language === 'en' ? 'en' : 'zh',
        }).mapping;

        return {
          success: true,
          scaleId: String(args?.scaleId || ''),
          questionId: Number(args?.questionId),
          mapping,
          needsConfirmation: mapping.score !== null && mapping.confidence < 0.8,
          requiresExplicitSelection: mapping.score !== null && mapping.confidence < 0.6,
        };
      }

      case 'confirm_mapped_answer':
        return {
          success: true,
          ...confirmMappedScaleAnswer({
            scaleId: String(args?.scaleId || ''),
            questionId: Number(args?.questionId),
            score: Number(args?.score),
            confidence: typeof args?.confidence === 'number' ? args.confidence : undefined,
            evidence: typeof args?.evidence === 'string' ? args.evidence : undefined,
          }),
        };

      case 'create_assessment_session': {
        const session = await createAssessmentSessionForDevice({
          deviceId: String(args?.deviceId || ''),
          scaleId: String(args?.scaleId || ''),
          memberId: typeof args?.memberId === 'string' ? args.memberId : undefined,
          language: args?.language === 'en' ? 'en' : 'zh',
          memberSnapshot:
            args?.memberSnapshot && typeof args.memberSnapshot === 'object'
              ? args.memberSnapshot
              : undefined,
        });
        const callback = await maybeRegisterCallback(args, session);
        const handoff = buildHandoffPayload(session);

        return {
          success: true,
          session,
          handoff,
          completion: buildCompletionPayload(session),
          ...(callback ? { callback } : {}),
          ...(handoff
            ? {
                nextAction: buildFastGptNextAction(args, session),
                userPrompt:
                  'Please open the handoff link (or scan the QR code), complete the form, then return and say "done".',
              }
            : {}),
        };
      }

      case 'generate_assessment_link': {
        const session = await generateAssessmentLinkForDevice({
          deviceId: String(args?.deviceId || ''),
          scaleId: String(args?.scaleId || ''),
          memberId: typeof args?.memberId === 'string' ? args.memberId : undefined,
          language: args?.language === 'en' ? 'en' : 'zh',
          memberSnapshot:
            args?.memberSnapshot && typeof args.memberSnapshot === 'object'
              ? args.memberSnapshot
              : undefined,
        });
        const callback = await maybeRegisterCallback(args, session);
        const handoff = buildHandoffPayload(session);

        return {
          success: true,
          flow: 'web_handoff',
          session,
          handoff,
          completion: buildCompletionPayload(session),
          ...(callback ? { callback } : {}),
          nextAction: buildFastGptNextAction(args, session),
          userPrompt:
            'Please open the handoff link (or scan the QR code), complete the form, then return and say "done".',
        };
      }

      case 'get_current_question': {
        const session = await getAssessmentSessionForDevice({
          deviceId: String(args?.deviceId || ''),
          sessionId: String(args?.sessionId || ''),
        });

        return {
          success: true,
          sessionId: session.sessionId,
          status: session.status,
          progress: session.progress,
          currentQuestion: session.currentQuestion,
        };
      }

      case 'submit_answer':
        return {
          success: true,
          session: await submitAssessmentAnswerForDevice({
            deviceId: String(args?.deviceId || ''),
            sessionId: String(args?.sessionId || ''),
            questionId: Number(args?.questionId),
            score: Number(args?.score),
          }),
        };

      case 'get_assessment_result': {
        const session = await getAssessmentSessionResultForDevice({
          deviceId: String(args?.deviceId || ''),
          sessionId: String(args?.sessionId || ''),
        });
        const callback =
          session.result && session.assessmentHistoryId
            ? await dispatchAssessmentCompletionCallback({
                assessmentSessionId: session.sessionId,
                sessionId: session.sessionId,
                scaleId: session.scaleId,
                result: {
                  scaleId: session.scaleId,
                  totalScore: session.result.totalScore,
                  conclusion: session.result.conclusion,
                  details: session.result.details,
                  assessmentHistoryId: session.assessmentHistoryId,
                },
                submittedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
              }).then(() => getAssessmentCompletionCallbackStatus(session.sessionId))
            : await getAssessmentCompletionCallbackStatus(session.sessionId);

        const handoff = buildHandoffPayload(session);
        const completion = buildCompletionPayload(session);

        return {
          success: true,
          session,
          handoff,
          completion,
          ...(callback ? { callback } : {}),
          result: session.result || null,
          ...(completion.shouldPollResult && handoff
            ? {
                userPrompt:
                  'The assessment form has not been submitted yet. Please ask the user to complete the handoff link or scan the QR code first.',
              }
            : {}),
        };
      }

      case 'pause_assessment_session':
        return {
          success: true,
          session: await pauseAssessmentSessionForDevice({
            deviceId: String(args?.deviceId || ''),
            sessionId: String(args?.sessionId || ''),
          }),
        };

      case 'resume_assessment_session':
        return {
          success: true,
          session: await resumeAssessmentSessionForDevice({
            deviceId: String(args?.deviceId || ''),
            sessionId: String(args?.sessionId || ''),
          }),
        };

      case 'cancel_assessment_session':
        return {
          success: true,
          session: await cancelAssessmentSessionForDevice({
            deviceId: String(args?.deviceId || ''),
            sessionId: String(args?.sessionId || ''),
          }),
        };

      case 'submit_and_evaluate': {
        const scored = await scoreAssessment({
          scaleId: String(args?.scaleId || ''),
          answers: args?.answers,
        });

        return {
          ...scored,
          legacy: true,
        };
      }

      case 'score_assessment':
        return await scoreAssessment({
          scaleId: String(args?.scaleId || ''),
          answers: args?.answers,
        });

      case 'submit_assessment':
        return await submitAssessmentLegacy({
          deviceId: String(args?.deviceId || ''),
          scaleId: String(args?.scaleId || ''),
          memberId: typeof args?.memberId === 'string' ? args.memberId : undefined,
          language: args?.language === 'en' ? 'en' : 'zh',
          memberSnapshot:
            args?.memberSnapshot && typeof args.memberSnapshot === 'object'
              ? args.memberSnapshot
              : undefined,
          answers: Array.isArray(args?.answers) ? args.answers : [],
        });

      default:
        throw new Error(`Unknown scale tool: ${name}`);
    }
  } catch (error) {
    const conflict = parseConflict(error);
    if (conflict) {
      return conflict;
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '量表工具调用失败',
      statusCode: 500,
    };
  }
}
