/**
 * 用户画像同步服务
 * 
 * 功能：
 * 1. 同步用户画像到后端
 * 2. 更新上下文记忆
 */

import { prisma } from '@/lib/db/prisma';

// 用户画像traits类型
interface UserTraits {
  interests: string[];
  fears: string[];
  behaviors?: string[];
  medicalHistory?: string[];
  lastConversation?: string;
  conversationCount?: number;
  recentTopics?: string[];
}

/**
 * 更新用户画像上下文
 */
export async function updateUserContext(
  deviceId: string,
  updates: Partial<UserTraits>
) {
  try {
    const memberProfileModel = (prisma as any).memberProfile ?? (prisma as any).childProfile;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { deviceId },
      include: { profiles: true }
    });

    if (!user || user.profiles.length === 0) {
      return { success: false, error: '用户不存在' };
    }

    const profile = user.profiles[0];
    const currentTraits = (profile.traits as unknown as UserTraits) || {
      interests: [],
      fears: [],
      behaviors: [],
      medicalHistory: [],
      conversationCount: 0,
      recentTopics: []
    };

    // 合并更新
    const updatedTraits: UserTraits = {
      ...currentTraits,
      ...updates,
      interests: updates.interests 
        ? [...new Set([...currentTraits.interests, ...updates.interests])]
        : currentTraits.interests,
      fears: updates.fears
        ? [...new Set([...currentTraits.fears, ...updates.fears])]
        : currentTraits.fears,
      behaviors: updates.behaviors
        ? [...new Set([...(currentTraits.behaviors || []), ...updates.behaviors])]
        : currentTraits.behaviors,
      lastConversation: new Date().toISOString(),
      conversationCount: (currentTraits.conversationCount || 0) + 1
    };

    // 更新数据库
    await memberProfileModel.update({
      where: { id: profile.id },
      data: { traits: JSON.parse(JSON.stringify(updatedTraits)) }
    });

    return { success: true, traits: updatedTraits };
  } catch (error) {
    console.error('Failed to update user context:', error);
    return { success: false, error: '更新失败' };
  }
}

/**
 * 获取用户画像上下文（用于AI调用）
 */
export async function getUserContext(deviceId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { deviceId },
      include: { profiles: true }
    });

    if (!user || user.profiles.length === 0) {
      return '';
    }

    const profile = user.profiles[0];
    const traits = (profile.traits as unknown as UserTraits) || {};

    // 构建上下文文本
    const contextParts: string[] = [];

    // 基本信息
    contextParts.push(`【用户画像】`);
    contextParts.push(`孩子昵称：${profile.nickname}`);
    contextParts.push(`性别：${profile.gender === 'boy' ? '男' : '女'}`);
    
    if (profile.ageMonths) {
      const years = Math.floor(profile.ageMonths / 12);
      const months = profile.ageMonths % 12;
      contextParts.push(`年龄：${years}岁${months}个月`);
    }

    // 兴趣爱好
    if (traits.interests && traits.interests.length > 0) {
      contextParts.push(`兴趣爱好：${traits.interests.join('、')}`);
    }

    // 恐惧事物
    if (traits.fears && traits.fears.length > 0) {
      contextParts.push(`害怕的事物：${traits.fears.join('、')}`);
    }

    // 行为特征
    if (traits.behaviors && traits.behaviors.length > 0) {
      contextParts.push(`行为特征：${traits.behaviors.join('、')}`);
    }

    // 医疗史
    if (traits.medicalHistory && traits.medicalHistory.length > 0) {
      contextParts.push(`医疗史：${traits.medicalHistory.join('、')}`);
    }

    // 对话统计
    if (traits.conversationCount) {
      contextParts.push(`已对话次数：${traits.conversationCount}次`);
    }

    return contextParts.join('\n');
  } catch (error) {
    console.error('Failed to get user context:', error);
    return '';
  }
}
