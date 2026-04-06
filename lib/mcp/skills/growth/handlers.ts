/**
 * 新生儿生长曲线 MCP Skill - WHO标准评估
 * 
 * 功能：
 * 1. add_growth_record - 添加生长记录并自动评估
 * 2. get_growth_history - 获取历史生长曲线
 * 3. evaluate_growth - 评估当前生长状态
 */

import { prisma } from '@/lib/db/prisma';

// WHO生长曲线标准数据（简化版，关键月龄）
// 数据来源：WHO Child Growth Standards
const WHO_STANDARDS = {
  boy: {
    weight: {
      // 月龄: { p3, p50, p97 }
      0: { p3: 2.5, p50: 3.3, p97: 4.4 },
      1: { p3: 3.4, p50: 4.5, p97: 5.8 },
      3: { p3: 5.0, p50: 6.4, p97: 8.0 },
      6: { p3: 6.4, p50: 7.9, p97: 9.8 },
      12: { p3: 7.7, p50: 9.6, p97: 12.0 },
      18: { p3: 8.8, p50: 10.9, p97: 13.7 },
      24: { p3: 9.7, p50: 12.2, p97: 15.3 },
      36: { p3: 11.3, p50: 14.3, p97: 18.3 },
      48: { p3: 12.7, p50: 16.3, p97: 21.2 },
      60: { p3: 14.1, p50: 18.3, p97: 24.2 },
    },
    height: {
      0: { p3: 46.3, p50: 49.9, p97: 53.7 },
      1: { p3: 50.7, p50: 54.7, p97: 58.7 },
      3: { p3: 57.3, p50: 61.4, p97: 65.5 },
      6: { p3: 63.3, p50: 67.6, p97: 71.9 },
      12: { p3: 71.0, p50: 75.7, p97: 80.5 },
      18: { p3: 76.9, p50: 82.3, p97: 87.7 },
      24: { p3: 81.7, p50: 87.8, p97: 94.0 },
      36: { p3: 88.7, p50: 96.1, p97: 103.6 },
      48: { p3: 94.4, p50: 103.3, p97: 112.2 },
      60: { p3: 99.9, p50: 110.0, p97: 119.8 },
    },
    headCircumference: {
      0: { p3: 32.1, p50: 34.5, p97: 36.9 },
      1: { p3: 34.2, p50: 36.5, p97: 38.8 },
      3: { p3: 37.4, p50: 39.9, p97: 42.3 },
      6: { p3: 40.2, p50: 42.8, p97: 45.4 },
      12: { p3: 43.1, p50: 45.8, p97: 48.5 },
      18: { p3: 44.7, p50: 47.5, p97: 50.3 },
      24: { p3: 45.7, p50: 48.6, p97: 51.5 },
      36: { p3: 46.9, p50: 49.8, p97: 52.8 },
      48: { p3: 47.7, p50: 50.6, p97: 53.6 },
      60: { p3: 48.3, p50: 51.3, p97: 54.3 },
    }
  },
  girl: {
    weight: {
      0: { p3: 2.4, p50: 3.2, p97: 4.2 },
      1: { p3: 3.2, p50: 4.2, p97: 5.5 },
      3: { p3: 4.5, p50: 5.8, p97: 7.5 },
      6: { p3: 5.8, p50: 7.3, p97: 9.3 },
      12: { p3: 7.0, p50: 8.9, p97: 11.5 },
      18: { p3: 8.1, p50: 10.2, p97: 13.2 },
      24: { p3: 9.0, p50: 11.5, p97: 14.8 },
      36: { p3: 10.8, p50: 13.9, p97: 18.1 },
      48: { p3: 12.3, p50: 16.1, p97: 21.5 },
      60: { p3: 13.7, p50: 18.2, p97: 24.9 },
    },
    height: {
      0: { p3: 45.6, p50: 49.1, p97: 52.9 },
      1: { p3: 49.8, p50: 53.7, p97: 57.6 },
      3: { p3: 55.6, p50: 59.8, p97: 64.0 },
      6: { p3: 61.2, p50: 65.7, p97: 70.3 },
      12: { p3: 68.9, p50: 74.0, p97: 79.2 },
      18: { p3: 74.9, p50: 80.7, p97: 86.5 },
      24: { p3: 79.4, p50: 86.4, p97: 93.1 },
      36: { p3: 86.6, p50: 95.1, p97: 103.6 },
      48: { p3: 92.5, p50: 102.3, p97: 112.1 },
      60: { p3: 98.1, p50: 109.1, p97: 120.2 },
    },
    headCircumference: {
      0: { p3: 31.5, p50: 33.8, p97: 36.1 },
      1: { p3: 33.5, p50: 35.8, p97: 38.1 },
      3: { p3: 36.6, p50: 39.0, p97: 41.4 },
      6: { p3: 39.3, p50: 41.8, p97: 44.3 },
      12: { p3: 42.1, p50: 44.8, p97: 47.5 },
      18: { p3: 43.6, p50: 46.4, p97: 49.2 },
      24: { p3: 44.6, p50: 47.4, p97: 50.3 },
      36: { p3: 45.7, p50: 48.6, p97: 51.6 },
      48: { p3: 46.4, p50: 49.4, p97: 52.4 },
      60: { p3: 47.0, p50: 50.0, p97: 53.1 },
    }
  }
};

// 线性插值计算任意月龄的标准值
function interpolate(months: number, standard: { [key: number]: { p3: number, p50: number, p97: number } }) {
  const monthKeys = Object.keys(standard).map(Number).sort((a, b) => a - b);
  
  // 找到最近的两个月龄
  let lowerMonth = monthKeys[0];
  let upperMonth = monthKeys[monthKeys.length - 1];
  
  for (let i = 0; i < monthKeys.length - 1; i++) {
    if (months >= monthKeys[i] && months <= monthKeys[i + 1]) {
      lowerMonth = monthKeys[i];
      upperMonth = monthKeys[i + 1];
      break;
    }
  }
  
  // 如果超出范围，使用最近的标准
  if (months <= monthKeys[0]) return standard[monthKeys[0]];
  if (months >= monthKeys[monthKeys.length - 1]) return standard[monthKeys[monthKeys.length - 1]];
  
  // 线性插值
  const ratio = (months - lowerMonth) / (upperMonth - lowerMonth);
  const lower = standard[lowerMonth];
  const upper = standard[upperMonth];
  
  return {
    p3: lower.p3 + (upper.p3 - lower.p3) * ratio,
    p50: lower.p50 + (upper.p50 - lower.p50) * ratio,
    p97: lower.p97 + (upper.p97 - lower.p97) * ratio,
  };
}

// 计算百分位（基于正态分布假设）
function calculatePercentile(value: number, p3: number, p50: number, p97: number): number {
  // 简化计算：使用线性映射
  // 实际应用中应使用更精确的LMS方法
  if (value <= p3) return 3 * (value / p3);
  if (value >= p97) return 97 + 3 * ((value - p97) / p97);
  
  // P3-P50区间
  if (value < p50) {
    return 3 + 47 * ((value - p3) / (p50 - p3));
  }
  
  // P50-P97区间
  return 50 + 47 * ((value - p50) / (p97 - p50));
}

// 评估状态
function evaluateStatus(percentile: number): string {
  if (percentile < 3) return '偏低';
  if (percentile < 15) return '偏下';
  if (percentile < 85) return '正常';
  if (percentile < 97) return '偏上';
  return '偏高';
}

// 1. 定义生长曲线工具列表
export const growthTools = [
  {
    name: "add_growth_record",
    description: "添加宝宝的生长记录（身高、体重、头围），自动根据WHO标准评估发育状况",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "用户设备指纹" },
        ageMonths: { type: "number", description: "月龄（0-60）" },
        weight: { type: "number", description: "体重（kg）" },
        height: { type: "number", description: "身高/身长（cm）" },
        headCircumference: { type: "number", description: "头围（cm）" },
        notes: { type: "string", description: "备注信息（可选）" }
      },
      required: ["deviceId", "ageMonths"]
    }
  },
  {
    name: "get_growth_history",
    description: "获取宝宝的历史生长曲线数据，用于绘制曲线图",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "用户设备指纹" },
        limit: { type: "number", description: "返回记录数量（默认10）" }
      },
      required: ["deviceId"]
    }
  },
  {
    name: "evaluate_growth",
    description: "评估宝宝当前的发育状况，提供综合建议",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "用户设备指纹" }
      },
      required: ["deviceId"]
    }
  }
];

// 2. 实现具体调用逻辑
export async function handleGrowthToolCall(name: string, args: any) {
  const { deviceId } = args;
  
  // 查找用户和档案
  const user = await prisma.user.findUnique({
    where: { deviceId },
    include: { profiles: true }
  });
  
  if (!user || user.profiles.length === 0) {
    return { error: "未找到用户档案，请先完成建档" };
  }
  
  const profile = user.profiles[0];
  const gender = profile.gender as 'boy' | 'girl';
  
  switch (name) {
    case "add_growth_record": {
      const { ageMonths, weight, height, headCircumference, notes } = args;
      
      // 获取WHO标准
      const standards = WHO_STANDARDS[gender];
      const weightStd = weight ? interpolate(ageMonths, standards.weight) : null;
      const heightStd = height ? interpolate(ageMonths, standards.height) : null;
      const headStd = headCircumference ? interpolate(ageMonths, standards.headCircumference) : null;
      
      // 计算百分位和状态
      const weightPercentile = weightStd ? calculatePercentile(weight, weightStd.p3, weightStd.p50, weightStd.p97) : null;
      const heightPercentile = heightStd ? calculatePercentile(height, heightStd.p3, heightStd.p50, heightStd.p97) : null;
      const headPercentile = headStd ? calculatePercentile(headCircumference, headStd.p3, headStd.p50, headStd.p97) : null;
      
      // 保存记录
      const record = await prisma.growthRecord.create({
        data: {
          profileId: profile.id,
          ageMonths,
          weight,
          height,
          headCircumference,
          weightPercentile,
          heightPercentile,
          headPercentile,
          weightStatus: weightPercentile ? evaluateStatus(weightPercentile) : null,
          heightStatus: heightPercentile ? evaluateStatus(heightPercentile) : null,
          headStatus: headPercentile ? evaluateStatus(headPercentile) : null,
          notes
        }
      });
      
      return {
        success: true,
        message: "生长记录已保存",
        record: {
          ageMonths: record.ageMonths,
          weight: record.weight,
          height: record.height,
          headCircumference: record.headCircumference,
          evaluations: {
            weight: weightPercentile ? { percentile: Math.round(weightPercentile), status: record.weightStatus } : null,
            height: heightPercentile ? { percentile: Math.round(heightPercentile), status: record.heightStatus } : null,
            headCircumference: headPercentile ? { percentile: Math.round(headPercentile), status: record.headStatus } : null
          }
        }
      };
    }
    
    case "get_growth_history": {
      const { limit = 10 } = args;
      
      const records = await prisma.growthRecord.findMany({
        where: { profileId: profile.id },
        orderBy: { ageMonths: 'asc' },
        take: limit
      });
      
      return {
        nickname: profile.nickname,
        gender: profile.gender,
        records: records.map(r => ({
          ageMonths: r.ageMonths,
          weight: r.weight,
          height: r.height,
          headCircumference: r.headCircumference,
          weightPercentile: r.weightPercentile ? Math.round(r.weightPercentile) : null,
          heightPercentile: r.heightPercentile ? Math.round(r.heightPercentile) : null,
          headPercentile: r.headPercentile ? Math.round(r.headPercentile) : null,
          date: r.createdAt.toISOString().split('T')[0]
        }))
      };
    }
    
    case "evaluate_growth": {
      // 获取最新记录
      const latestRecord = await prisma.growthRecord.findFirst({
        where: { profileId: profile.id },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!latestRecord) {
        return { error: "暂无生长记录，请先添加测量数据" };
      }
      
      // 生成综合评估
      const recommendations: string[] = [];
      
      if (latestRecord.weightStatus === '偏低') {
        recommendations.push("体重偏低，建议关注喂养频率和营养摄入");
      } else if (latestRecord.weightStatus === '偏高') {
        recommendations.push("体重偏高，建议适当控制饮食，增加运动");
      }
      
      if (latestRecord.heightStatus === '偏低') {
        recommendations.push("身高偏矮，建议补充维生素D，保证充足睡眠");
      }
      
      if (latestRecord.headStatus === '偏低' || latestRecord.headStatus === '偏高') {
        recommendations.push("头围异常，建议咨询儿科医生");
      }
      
      return {
        nickname: profile.nickname,
        ageMonths: latestRecord.ageMonths,
        evaluation: {
          weight: {
            value: latestRecord.weight,
            percentile: latestRecord.weightPercentile ? Math.round(latestRecord.weightPercentile) : null,
            status: latestRecord.weightStatus
          },
          height: {
            value: latestRecord.height,
            percentile: latestRecord.heightPercentile ? Math.round(latestRecord.heightPercentile) : null,
            status: latestRecord.heightStatus
          },
          headCircumference: {
            value: latestRecord.headCircumference,
            percentile: latestRecord.headPercentile ? Math.round(latestRecord.headPercentile) : null,
            status: latestRecord.headStatus
          }
        },
        recommendations: recommendations.length > 0 ? recommendations : ["各项指标正常，继续保持良好的喂养和作息习惯"],
        lastUpdate: latestRecord.createdAt.toISOString().split('T')[0]
      };
    }
    
    default:
      throw new Error(`Unknown growth tool: ${name}`);
  }
}
