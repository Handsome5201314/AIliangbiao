/**
 * 量表评估服务 MCP Skill
 * 
 * 功能：
 * 1. list_scales - 获取所有可用量表
 * 2. get_scale_questions - 获取量表问题
 * 3. submit_assessment - 提交答案并获取评估结果
 */

import { prisma } from '@/lib/db/prisma';
import { AllScales } from '@/lib/schemas/core/registry';

/**
 * 获取系统默认每日配额
 */
async function getDefaultDailyLimit(): Promise<number> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: 'defaultDailyLimit' }
    });
    return config ? parseInt(config.configValue) : 10;
  } catch (error) {
    console.error('[Get Default Limit Error]:', error);
    return 10; // 默认值
  }
}

// 量表评估工具列表
export const scaleTools = [
  {
    name: "list_scales",
    description: "获取平台所有可用的量表列表，包括量表ID、标题、描述、题目数量等信息",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_scale_questions",
    description: "获取指定量表的详细问题列表，用于进行评估",
    inputSchema: {
      type: "object",
      properties: {
        scaleId: { 
          type: "string", 
          description: "量表ID，如 ABC, CARS, SRS, SNAP-IV" 
        }
      },
      required: ["scaleId"]
    }
  },
  {
    name: "submit_assessment",
    description: "提交量表评估答案并获取评估结果和临床结论",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { 
          type: "string", 
          description: "用户设备ID（游客模式）或用户ID" 
        },
        scaleId: { 
          type: "string", 
          description: "量表ID" 
        },
        answers: { 
          type: "array",
          items: { type: "number" },
          description: "用户的答案数组，每个元素对应该题的选项索引（0-3）" 
        }
      },
      required: ["deviceId", "scaleId", "answers"]
    }
  }
];

// 计算量表得分
function calculateScore(scaleId: string, answers: number[]): { totalScore: number; conclusion: string } {
  const scale = AllScales.find(s => s.id.toUpperCase() === scaleId.toUpperCase());
  
  if (!scale) {
    throw new Error(`量表 ${scaleId} 不存在`);
  }

  if (answers.length !== scale.questions.length) {
    throw new Error(`答案数量不匹配，需要 ${scale.questions.length} 个答案，实际 ${answers.length} 个`);
  }

  // 计算总分
  let totalScore = 0;
  answers.forEach((answer, index) => {
    const question = scale.questions[index];
    // 假设答案索引对应分数（0,1,2,3）
    totalScore += Math.min(answer, question.options.length - 1);
  });

  // 生成临床结论
  let conclusion = '';
  const percentage = totalScore / (scale.questions.length * 3); // 最高分是题目数*3

  if (scale.id === 'ABC') {
    if (totalScore >= 67) conclusion = '高度疑似自闭症谱系障碍，建议进一步专业评估';
    else if (totalScore >= 54) conclusion = '中度疑似，建议关注并考虑专业咨询';
    else conclusion = '风险较低，建议持续观察';
  } else if (scale.id === 'CARS') {
    if (totalScore >= 30) conclusion = '轻度自闭症倾向';
    else if (totalScore >= 36) conclusion = '中度自闭症倾向';
    else if (totalScore >= 45) conclusion = '重度自闭症倾向';
    else conclusion = '未达到自闭症诊断标准';
  } else if (scale.id === 'SRS') {
    if (percentage >= 0.7) conclusion = '社交反应能力明显受损，建议专业干预';
    else if (percentage >= 0.5) conclusion = '社交能力存在一定困难，建议关注';
    else conclusion = '社交能力正常范围';
  } else if (scale.id === 'SNAP-IV') {
    if (percentage >= 0.7) conclusion = '注意力缺陷/多动症状明显，建议就医评估';
    else if (percentage >= 0.5) conclusion = '存在注意力或多动倾向，建议关注';
    else conclusion = '注意力水平正常';
  } else {
    conclusion = percentage >= 0.6 ? '评估结果偏高，建议关注' : '评估结果正常';
  }

  return { totalScore, conclusion };
}

// 处理量表工具调用
export async function handleScaleToolCall(name: string, args: any) {
  switch (name) {
    case "list_scales": {
      // 返回所有量表列表
      const scales = AllScales.map(scale => ({
        id: scale.id,
        title: scale.title,
        description: scale.description,
        questionCount: scale.questions.length,
        estimatedTime: scale.questions.length <= 20 ? '5分钟' : 
                      scale.questions.length <= 40 ? '8分钟' : 
                      scale.questions.length <= 60 ? '12分钟' : '15分钟'
      }));

      return {
        success: true,
        totalCount: scales.length,
        scales: scales
      };
    }

    case "get_scale_questions": {
      const { scaleId } = args;
      
      // 查找量表
      const scale = AllScales.find(s => s.id.toUpperCase() === scaleId.toUpperCase());
      
      if (!scale) {
        return { error: `量表 ${scaleId} 不存在，可用量表：${AllScales.map(s => s.id).join(', ')}` };
      }

      // 返回问题列表（简化版，不包含评估逻辑）
      const questions = scale.questions.map((q, index) => ({
        index: index + 1,
        question: q.text,
        options: q.options
      }));

      return {
        scaleId: scale.id,
        scaleTitle: scale.title,
        questionCount: questions.length,
        questions: questions
      };
    }

    case "submit_assessment": {
      const { deviceId, scaleId, answers } = args;

      try {
        // ✅ 修复点1：使用 upsert 原子操作，避免并发创建用户时的竞态条件
        // 原因：多个智能体可能同时为新用户创建记录，使用 upsert 保证原子性
        // 效果：无论多少个并发请求，都只会创建一个用户，不会出现重复或失败
        const user = await prisma.user.upsert({
          where: { deviceId },
          update: {}, // 如果用户已存在，不更新任何字段
          create: {
            deviceId,
            isGuest: true,
            dailyLimit: await getDefaultDailyLimit(),
            dailyUsed: 0
          }
        });

        // ✅ 修复点2：使用原子 SQL 操作扣除配额
        // 原因：读-改-写操作在并发时会导致配额超限
        // 效果：数据库层面保证原子性，不会出现配额超限
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

        // 计算得分
        const { totalScore, conclusion } = calculateScore(scaleId, answers);

        // ✅ 修复点3：添加防重复提交保护
        // 原因：短时间内可能收到重复的评估请求
        // 效果：5秒内的重复请求返回已有结果，避免重复评估
        const recentAssessment = await prisma.assessmentHistory.findFirst({
          where: {
            userId: user.id,
            scaleId: scaleId.toUpperCase(),
            createdAt: {
              gte: new Date(Date.now() - 5000) // 5秒内
            }
          }
        });

        if (recentAssessment) {
          // 返回已有的评估结果
          return {
            success: true,
            assessmentId: recentAssessment.id,
            scaleId: scaleId.toUpperCase(),
            totalScore: recentAssessment.totalScore,
            conclusion: recentAssessment.conclusion,
            evaluatedAt: recentAssessment.createdAt.toISOString(),
            message: '评估已完成（复用最近结果）'
          };
        }

        // 保存评估历史
        const assessment = await prisma.assessmentHistory.create({
          data: {
            userId: user.id,
            scaleId: scaleId.toUpperCase(),
            totalScore,
            conclusion,
            answers: answers
          }
        });

        return {
          success: true,
          assessmentId: assessment.id,
          scaleId: scaleId.toUpperCase(),
          totalScore,
          conclusion,
          evaluatedAt: assessment.createdAt.toISOString(),
          message: '评估已完成并保存'
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
