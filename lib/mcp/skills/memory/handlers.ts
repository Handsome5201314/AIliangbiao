/**
 * 记忆中枢 MCP Skill - 用户画像与记忆管理
 * 
 * 功能：
 * 1. get_user_memory - 获取用户画像和历史记忆
 * 2. save_user_memory - 保存对话中发现的新兴趣/恐惧
 */

import { prisma } from '@/lib/db/prisma';

// 1. 定义记忆中枢提供的 Tools
export const memoryTools = [
  {
    name: "get_user_memory",
    description: "获取宝宝的档案、历史记忆、兴趣爱好和害怕的事物，用于在对话前了解用户背景。",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "用户的设备指纹或唯一标识符" }
      },
      required: ["deviceId"]
    }
  },
  {
    name: "save_user_memory",
    description: "在对话过程中，如果发现宝宝有新的兴趣爱好或害怕的事物，调用此工具更新记忆数据库。",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string" },
        interest: { type: "string", description: "发现的新兴趣，如'喜欢恐龙'" },
        fear: { type: "string", description: "发现的新恐惧，如'害怕大声音'" }
      },
      required: ["deviceId"]
    }
  }
];

// 2. 实现具体的调用逻辑
export async function handleMemoryToolCall(name: string, args: any) {
  const { deviceId } = args;
  const memberProfileModel = (prisma as any).memberProfile ?? (prisma as any).childProfile;

  // 校验用户是否存在
  const user = await prisma.user.findUnique({
    where: { deviceId },
    include: { profiles: true }
  });

  if (!user || user.profiles.length === 0) {
    return { error: "未找到该用户的档案信息，请提示用户先完成建档。" };
  }

  const profile = user.profiles[0];
  const currentTraits = (profile.traits as any) || { interests: [], fears: [] };

  switch (name) {
    case "get_user_memory":
      return {
        nickname: profile.nickname,
        gender: profile.gender,
        ageMonths: profile.ageMonths,
        traits: currentTraits
      };

    case "save_user_memory":
      const { interest, fear } = args;
      
      // 更新记忆标签
      if (interest && !currentTraits.interests.includes(interest)) {
        currentTraits.interests.push(interest);
      }
      if (fear && !currentTraits.fears.includes(fear)) {
        currentTraits.fears.push(fear);
      }

      await memberProfileModel.update({
        where: { id: profile.id },
        data: { traits: currentTraits }
      });

      return { status: "success", message: "记忆已成功更新并持久化" };

    default:
      throw new Error(`Unknown memory tool: ${name}`);
  }
}
