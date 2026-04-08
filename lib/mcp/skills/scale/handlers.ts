import { prisma } from '@/lib/db/prisma';
import { evaluateScaleAnswers, getScaleDefinitionById, listSerializableScales } from '@/lib/scales/catalog';
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
        }
      },
      required: ['deviceId', 'scaleId', 'answers']
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
      const { deviceId, scaleId, answers } = args;

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

        const result = evaluateScaleAnswers(scale.id, answers);

        const assessment = await prisma.assessmentHistory.create({
          data: {
            userId: user.id,
            scaleId: scale.id,
            scaleVersion: scale.version || '1.0',
            totalScore: result.totalScore,
            conclusion: result.conclusion,
            answers
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

    default:
      throw new Error(`Unknown scale tool: ${name}`);
  }
}
