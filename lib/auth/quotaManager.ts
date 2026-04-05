import { prisma } from '@/lib/db/prisma';

/**
 * 访客逻辑与每日额度管理器
 */
export class QuotaManager {
  /**
   * 获取系统默认配额
   */
  private static async getDefaultDailyLimit(): Promise<number> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { configKey: 'defaultDailyLimit' }
      });
      return config ? parseInt(config.configValue) : 1;
    } catch (error) {
      console.error('[Get Default Limit Error]:', error);
      return 1; // 默认值
    }
  }

  /**
   * 核心逻辑：获取或初始化游客账号，并进行每日额度重置检查
   * 
   * ✅ 修复：使用 upsert 原子操作，避免并发创建用户时的竞态条件
   * 
   * 原原理：
   * - 读-改-写模式存在竞态窗口
   * - 多个请求可能同时创建用户，导致失败
   * 
   * 新原理：
   * - 使用 upsert 保证原子性
   * - 如果用户存在，检查是否需要重置配额
   * - 如果用户不存在，创建新用户
   */
  static async getOrCreateGuest(deviceId: string) {
    const defaultLimit = await this.getDefaultDailyLimit();
    const now = new Date();
    
    // ✅ 使用 upsert 原子操作，避免竞态条件
    let user = await prisma.user.upsert({
      where: { deviceId },
      update: {
        // 如果用户存在，检查是否需要重置配额
        // 注意：这里不能直接在 update 中做条件判断
        // 所以我们在 upsert 后单独处理重置逻辑
      },
      create: {
        deviceId,
        isGuest: true,
        dailyLimit: defaultLimit,
        dailyUsed: 0,
        lastResetAt: now,
      },
    });

    // 检查是否跨天，跨天则重置 dailyUsed
    const lastReset = new Date(user.lastResetAt);
    
    // 如果今天和上次重置不是同一天
    if (now.toDateString() !== lastReset.toDateString()) {
      // ✅ 使用原子操作重置配额
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          dailyUsed: 0,
          dailyLimit: defaultLimit, // 更新为最新的系统配额
          lastResetAt: now, // 刷新重置时间
        },
      });
    }

    return user;
  }

  /**
   * 扣除额度（在调用 submit_and_evaluate 算出结果后触发）
   * ✅ 修复：使用原子 SQL 操作，避免并发竞态条件
   * 
   * 原理：
   * - 使用数据库的原子操作（UPDATE ... WHERE ...）
   * - 一次操作完成检查和扣除
   * - 不存在读-改-写的竞态窗口
   * 
   * 效果：
   * - 完全避免配额超限
   * - 性能更好（减少一次数据库查询）
   * - 并发安全
   */
  static async consumeQuota(deviceId: string): Promise<boolean> {
    try {
      // ✅ 使用原子 SQL 操作：检查 + 扣除一次完成
      // WHERE 条件确保只有配额充足时才会扣除
      const result = await prisma.$executeRaw`
        UPDATE "User"
        SET "dailyUsed" = "dailyUsed" + 1
        WHERE "deviceId" = ${deviceId}
          AND "dailyUsed" < "dailyLimit"
      `;

      // result = 受影响的行数
      // 0 = 配额不足或用户不存在
      // 1 = 扣除成功
      return result > 0;
    } catch (error) {
      console.error('[Consume Quota Error]:', error);
      return false;
    }
  }

  /**
   * 检查剩余额度
   */
  static async getRemainingQuota(deviceId: string): Promise<number> {
    const user = await this.getOrCreateGuest(deviceId);
    return Math.max(0, user.dailyLimit - user.dailyUsed);
  }
}
