import { prisma } from '@/lib/db/prisma';
import { QuotaManager } from '@/lib/auth/quotaManager';
import {
  evaluateScaleAnswers,
  getScaleDefinitionById,
  listSerializableScales,
  normalizeScaleFormData,
} from '@/lib/scales/catalog';
import {
  createAssessmentSession,
  getAssessmentSession,
  submitAssessmentSessionAnswer,
} from '@/lib/assessment-skill/session-service';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

async function getDefaultDailyLimit(): Promise<number> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: 'defaultDailyLimit' }
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

function serializeSessionForMcp(session: Awaited<ReturnType<typeof getAssessmentSession>>) {
  return {
    sessionId: session.sessionId,
    scaleId: session.scaleId,
    status: session.status,
    channel: session.channel,
    currentQuestionIndex: session.currentQuestionIndex,
    answeredCount: session.answeredCount,
    questionCount: session.questionCount,
    currentQuestion: session.currentQuestion
      ? {
          id: session.currentQuestion.id,
          externalId: session.currentQuestion.externalId,
          text: resolveLocalizedText(session.currentQuestion.text, 'zh'),
          colloquial: resolveLocalizedText(session.currentQuestion.colloquial, 'zh'),
          options: session.currentQuestion.options,
        }
      : null,
    formData: session.formData,
    result: session.result,
    assessmentId: session.assessmentId,
  };
}

export const scaleTools = [
  {
    name: 'list_scales',
    description: '获取平台可用量表列表',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_scale_questions',
    description: '获取指定量表的题目与选项',
    inputSchema: {
      type: 'object',
      properties: {
        scaleId: {
          type: 'string',
          description: '量表 ID，例如 ABC、PHQ-9、GAD-7'
        }
      },
      required: ['scaleId']
    }
  },
  {
    name: 'submit_assessment',
    description: '提交量表答案并返回确定性评分结果',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'string',
          description: '设备 ID'
        },
        scaleId: {
          type: 'string',
          description: '量表 ID'
        },
        answers: {
          type: 'array',
          items: { type: 'number' },
          description: '用户答案分数数组'
        },
        formData: {
          type: 'object',
          description: '结构化量表的前置表单数据（如患者信息）'
        }
      },
      required: ['deviceId', 'scaleId', 'answers']
    }
  },
  {
    name: 'start_assessment_session',
    description: '创建量表评估会话，返回当前题目或待填写表单状态',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'string',
          description: '设备 ID'
        },
        scaleId: {
          type: 'string',
          description: '量表 ID'
        },
        formData: {
          type: 'object',
          description: '量表前置表单数据（如果量表要求）'
        }
      },
      required: ['deviceId', 'scaleId']
    }
  },
  {
    name: 'get_current_question',
    description: '获取当前评估会话的状态和当前题目',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: '评估会话 ID'
        },
        deviceId: {
          type: 'string',
          description: '设备 ID'
        }
      },
      required: ['sessionId', 'deviceId']
    }
  },
  {
    name: 'submit_answer',
    description: '提交当前题答案并推进到下一题或返回结果',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: '评估会话 ID'
        },
        deviceId: {
          type: 'string',
          description: '设备 ID'
        },
        score: {
          type: 'number',
          description: '当前题得分'
        },
        questionId: {
          type: 'number',
          description: '当前题题号'
        },
        formData: {
          type: 'object',
          description: '当会话还处于基础信息阶段时，可提交表单数据'
        }
      },
      required: ['sessionId', 'deviceId']
    }
  },
  {
    name: 'get_assessment_result',
    description: '读取已完成评估会话的最终结果',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: '评估会话 ID'
        },
        deviceId: {
          type: 'string',
          description: '设备 ID'
        }
      },
      required: ['sessionId', 'deviceId']
    }
  }
];

export async function handleScaleToolCall(name: string, args: any) {
  switch (name) {
    case 'list_scales': {
      const scales = listSerializableScales().map((scale) => ({
        id: scale.id,
        title: resolveLocalizedText(scale.title, 'zh'),
        description: resolveLocalizedText(scale.description, 'zh'),
        questionCount: scale.questions.length,
        estimatedTime: estimateScaleTime(scale.questions.length, scale.estimatedMinutes),
        category: scale.category,
        source: scale.source || 'builtin',
        tags: scale.tags || [],
      }));

      return {
        success: true,
        totalCount: scales.length,
        scales,
      };
    }

    case 'get_scale_questions': {
      const { scaleId } = args;
      const scale = getScaleDefinitionById(scaleId);

      if (!scale) {
        const availableScaleIds = listSerializableScales().map((item) => item.id).join(', ');
        return { error: `量表 ${scaleId} 不存在，可用量表：${availableScaleIds}` };
      }

      return {
        scaleId: scale.id,
        scaleTitle: resolveLocalizedText(scale.title, 'zh'),
        questionCount: scale.questions.length,
        questions: scale.questions.map((question, index) => ({
          index: index + 1,
          question: resolveLocalizedText(question.text, 'zh'),
          colloquial: resolveLocalizedText(question.colloquial, 'zh'),
          options: question.options,
        })),
      };
    }

    case 'submit_assessment': {
      const { deviceId, scaleId, answers, formData } = args;

      try {
        const scale = getScaleDefinitionById(scaleId);
        if (!scale) {
          return {
            success: false,
            error: `量表 ${scaleId} 不存在`
          };
        }

        if (!Array.isArray(answers) || answers.length !== scale.questions.length) {
          return {
            success: false,
            error: `答案数量不匹配，需要 ${scale.questions.length} 个答案，实际 ${Array.isArray(answers) ? answers.length : 0} 个`
          };
        }

        const user = await prisma.user.upsert({
          where: { deviceId },
          update: {},
          create: {
            deviceId,
            isGuest: true,
            dailyLimit: await getDefaultDailyLimit(),
            dailyUsed: 0
          }
        });

        const quotaResult = await prisma.$executeRaw`
          UPDATE "User"
          SET "dailyUsed" = "dailyUsed" + 1
          WHERE "id" = ${user.id}
            AND "dailyUsed" < "dailyLimit"
        `;

        if (quotaResult === 0) {
          return {
            success: false,
            error: '今日评估次数已达上限，请明天再试'
          };
        }

        const recentAssessment = await prisma.assessmentHistory.findFirst({
          where: {
            userId: user.id,
            scaleId: scale.id,
            createdAt: {
              gte: new Date(Date.now() - 5000)
            }
          }
        });

        if (recentAssessment) {
          return {
            success: true,
            assessmentId: recentAssessment.id,
            scaleId: scale.id,
            totalScore: recentAssessment.totalScore,
            conclusion: recentAssessment.conclusion,
            evaluatedAt: recentAssessment.createdAt.toISOString(),
            message: '复用最近一次评分结果'
          };
        }

        const normalizedFormData = normalizeScaleFormData(scale.id, formData);
        const result = evaluateScaleAnswers(scale.id, answers, normalizedFormData);

        const assessment = await prisma.assessmentHistory.create({
          data: {
            userId: user.id,
            scaleId: scale.id,
            scaleVersion: scale.version || '1.0',
            totalScore: result.totalScore,
            conclusion: result.conclusion,
            answers,
            formData: normalizedFormData ? JSON.parse(JSON.stringify(normalizedFormData)) : undefined,
            resultDetails: result.details ? JSON.parse(JSON.stringify(result.details)) : undefined,
          }
        });

        return {
          success: true,
          assessmentId: assessment.id,
          scaleId: scale.id,
          totalScore: result.totalScore,
          conclusion: result.conclusion,
          evaluatedAt: assessment.createdAt.toISOString(),
          message: '评估完成并已保存'
        };
      } catch (error) {
        console.error('Assessment error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '评估失败'
        };
      }
    }

    case 'start_assessment_session': {
      const { deviceId, scaleId, formData } = args;

      try {
        const user = await QuotaManager.getOrCreateGuest(deviceId);
        const session = await createAssessmentSession({
          userId: user.id,
          scaleId,
          channel: 'mcp',
          formData,
          deviceId,
        });

        return {
          success: true,
          ...serializeSessionForMcp(session),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '创建评估会话失败',
        };
      }
    }

    case 'get_current_question': {
      const { sessionId, deviceId } = args;

      try {
        const user = await QuotaManager.getOrCreateGuest(deviceId);
        const session = await getAssessmentSession(sessionId, user.id);

        return {
          success: true,
          ...serializeSessionForMcp(session),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '读取评估会话失败',
        };
      }
    }

    case 'submit_answer': {
      const { sessionId, deviceId, score, questionId, formData } = args;

      try {
        const user = await QuotaManager.getOrCreateGuest(deviceId);
        const session = await submitAssessmentSessionAnswer({
          sessionId,
          userId: user.id,
          score,
          questionId,
          formData,
        });

        return {
          success: true,
          ...serializeSessionForMcp(session),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '提交答案失败',
        };
      }
    }

    case 'get_assessment_result': {
      const { sessionId, deviceId } = args;

      try {
        const user = await QuotaManager.getOrCreateGuest(deviceId);
        const session = await getAssessmentSession(sessionId, user.id);
        if (session.status !== 'completed' || !session.result) {
          return {
            success: false,
            error: '评估尚未完成',
          };
        }

        return {
          success: true,
          sessionId: session.sessionId,
          scaleId: session.scaleId,
          assessmentId: session.assessmentId,
          result: session.result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '读取评估结果失败',
        };
      }
    }

    default:
      throw new Error(`Unknown scale tool: ${name}`);
  }
}
