import { prisma } from '@/lib/db/prisma';

/**
 * 访客逻辑与每日额度管理器
 */
type PlatformUserRole = 'GUEST' | 'REGISTERED' | 'VIP';

type PlatformUserRecord = {
  id: string;
  role: PlatformUserRole;
  isGuest: boolean;
  deviceId: string | null;
  phone: string | null;
  email: string | null;
  dailyUsed: number;
  dailyLimit: number;
  lastResetAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export class QuotaManager {
  private static readonly FALLBACK_DAILY_LIMITS: Record<PlatformUserRole, number> = {
    GUEST: 5,
    REGISTERED: 10,
    VIP: 999,
  };

  /**
   * 获取指定角色的默认配额
   */
  private static async getDailyLimitForRole(role: PlatformUserRole): Promise<number> {
    const configKeyMap: Record<PlatformUserRole, string> = {
      GUEST: 'guestDailyLimit',
      REGISTERED: 'registeredDailyLimit',
      VIP: 'vipDailyLimit',
    };

    try {
      const config = await prisma.systemConfig.findUnique({
        where: { configKey: configKeyMap[role] }
      });

      if (!config) {
        return this.FALLBACK_DAILY_LIMITS[role];
      }

      const parsed = parseInt(config.configValue, 10);
      return Number.isFinite(parsed) ? parsed : this.FALLBACK_DAILY_LIMITS[role];
    } catch (error) {
      console.error('[Get Daily Limit Error]:', error);
      return this.FALLBACK_DAILY_LIMITS[role];
    }
  }

  private static resolveUserRole(user: Partial<PlatformUserRecord>): PlatformUserRole {
    if (user.role === 'REGISTERED' || user.role === 'VIP') {
      return user.role;
    }

    if (user.isGuest === false || user.phone || user.email) {
      return 'REGISTERED';
    }

    return 'GUEST';
  }

  private static isSameCalendarDay(date: Date, other: Date): boolean {
    return date.toDateString() === other.toDateString();
  }

  private static normalizeQuotaState(
    user: PlatformUserRecord,
    role: PlatformUserRole,
    expectedDailyLimit: number,
    now: Date
  ) {
    const lastResetAt = new Date(user.lastResetAt);
    const shouldReset = !this.isSameCalendarDay(now, lastResetAt);

    return {
      dailyUsed: shouldReset ? 0 : user.dailyUsed,
      dailyLimit: expectedDailyLimit,
      lastResetAt: shouldReset ? now : lastResetAt,
      shouldReset,
    };
  }

  private static async findUserByDeviceId(deviceId: string) {
    return await (prisma.user as any).findUnique({
      where: { deviceId },
    }) as PlatformUserRecord | null;
  }

  /**
   * 获取当前设备归属的用户。
   * 如果没有用户，则创建游客账号，默认每日 5 次额度。
   * 如果已存在用户，则根据角色自动修正 dailyLimit，并做跨天重置。
   */
  static async getOrCreateGuest(deviceId: string) {
    const guestLimit = await this.getDailyLimitForRole('GUEST');
    const now = new Date();

    let user = await this.findUserByDeviceId(deviceId);

    if (!user) {
      try {
        user = await (prisma.user as any).create({
          data: {
            role: 'GUEST',
            deviceId,
            isGuest: true,
            dailyLimit: guestLimit,
            dailyUsed: 0,
            lastResetAt: now,
          },
        }) as PlatformUserRecord;
      } catch (error: any) {
        // Multiple parallel first-visit requests can race on the unique deviceId.
        // In that case, load the winner row instead of surfacing a 500.
        if (error?.code === 'P2002') {
          user = await this.findUserByDeviceId(deviceId);
        } else {
          throw error;
        }
      }
    }

    if (!user) {
      throw new Error(`Failed to resolve guest user for deviceId: ${deviceId}`);
    }

    const role = this.resolveUserRole(user);
    const expectedDailyLimit = await this.getDailyLimitForRole(role);
    const normalized = this.normalizeQuotaState(user, role, expectedDailyLimit, now);

    if (
      normalized.shouldReset ||
      user.dailyLimit !== expectedDailyLimit ||
      user.isGuest !== (role === 'GUEST')
    ) {
      user = await (prisma.user as any).update({
        where: { id: user.id },
        data: {
          dailyUsed: normalized.dailyUsed,
          dailyLimit: normalized.dailyLimit,
          lastResetAt: normalized.lastResetAt,
          role,
          isGuest: role === 'GUEST',
        },
      }) as PlatformUserRecord;
    }

    return user;
  }

  /**
   * 将游客账号升级为注册账号，并合并该设备下已有的历史数据。
   * - 游客默认升级为 REGISTERED
   * - 如果手机号/邮箱已对应到现有注册账号，则把游客历史合并到该账号
   * - 升级后每日额度自动提升到 10 次
   */
  static async upgradeToRegisteredUser(deviceId: string, phone?: string, email?: string) {
    if (!phone && !email) {
      throw new Error('升级注册用户时至少需要手机号或邮箱之一');
    }

    const now = new Date();
    const registeredLimit = await this.getDailyLimitForRole('REGISTERED');
    const vipLimit = await this.getDailyLimitForRole('VIP');
    const guestUser = await this.getOrCreateGuest(deviceId) as PlatformUserRecord;

    const matchingConditions = [phone ? { phone } : null, email ? { email } : null].filter(Boolean);

    if (!matchingConditions.length) {
      throw new Error('缺少可用于升级的注册标识');
    }

    const existingRegisteredUser = await (prisma.user as any).findFirst({
      where: {
        OR: matchingConditions,
        NOT: { id: guestUser.id },
      },
    }) as PlatformUserRecord | null;

    if (!existingRegisteredUser) {
      const normalizedGuest = this.normalizeQuotaState(guestUser, 'REGISTERED', registeredLimit, now);

      return await (prisma.user as any).update({
        where: { id: guestUser.id },
        data: {
          role: 'REGISTERED',
          isGuest: false,
          phone: phone ?? guestUser.phone,
          email: email ?? guestUser.email,
          dailyLimit: normalizedGuest.dailyLimit,
          dailyUsed: normalizedGuest.dailyUsed,
          lastResetAt: normalizedGuest.lastResetAt,
        },
      });
    }

    const targetRole: PlatformUserRole = this.resolveUserRole(existingRegisteredUser) === 'VIP' ? 'VIP' : 'REGISTERED';
    const targetLimit = targetRole === 'VIP' ? vipLimit : registeredLimit;

    return await prisma.$transaction(async (tx) => {
      const sourceUser = await (tx.user as any).findUnique({
        where: { id: guestUser.id },
      }) as PlatformUserRecord | null;

      const targetUser = await (tx.user as any).findUnique({
        where: { id: existingRegisteredUser.id },
      }) as PlatformUserRecord | null;

      if (!sourceUser || !targetUser) {
        throw new Error('升级过程中用户记录不存在');
      }

      const normalizedSource = this.normalizeQuotaState(sourceUser, 'GUEST', await this.getDailyLimitForRole('GUEST'), now);
      const normalizedTarget = this.normalizeQuotaState(targetUser, targetRole, targetLimit, now);
      const mergedDailyUsed = normalizedSource.dailyUsed + normalizedTarget.dailyUsed;

      await tx.$executeRaw`UPDATE "AssessmentHistory" SET "userId" = ${targetUser.id} WHERE "userId" = ${sourceUser.id}`;
      await tx.$executeRaw`UPDATE "TriageSession" SET "userId" = ${targetUser.id} WHERE "userId" = ${sourceUser.id}`;
      await tx.$executeRaw`UPDATE "McpLog" SET "userId" = ${targetUser.id} WHERE "userId" = ${sourceUser.id}`;
      await tx.$executeRaw`UPDATE "ApiKey" SET "userId" = ${targetUser.id} WHERE "userId" = ${sourceUser.id}`;
      await tx.$executeRaw`UPDATE "SpeechUsage" SET "userId" = ${targetUser.id} WHERE "userId" = ${sourceUser.id}`;
      await (tx.$executeRawUnsafe as any)(
        'UPDATE "ChildProfile" SET "userId" = $1 WHERE "userId" = $2',
        targetUser.id,
        sourceUser.id
      );

      await (tx.user as any).update({
        where: { id: sourceUser.id },
        data: { deviceId: null },
      });

      const mergedUser = await (tx.user as any).update({
        where: { id: targetUser.id },
        data: {
          role: targetRole,
          isGuest: false,
          phone: phone ?? targetUser.phone,
          email: email ?? targetUser.email,
          deviceId,
          dailyLimit: targetLimit,
          dailyUsed: mergedDailyUsed,
          lastResetAt: normalizedTarget.lastResetAt,
        },
      });

      await (tx.user as any).delete({
        where: { id: sourceUser.id },
      });

      return mergedUser;
    });
  }

  /**
   * 扣除额度（在调用 submit_and_evaluate 算出结果后触发）
   * 使用原子 SQL 操作，避免并发下的额度穿透。
   */
  static async consumeQuota(deviceId: string): Promise<boolean> {
    try {
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
    const user = await this.getOrCreateGuest(deviceId) as PlatformUserRecord;
    return Math.max(0, user.dailyLimit - user.dailyUsed);
  }
}
