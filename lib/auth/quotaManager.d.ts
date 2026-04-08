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
export declare class QuotaManager {
    private static readonly FALLBACK_DAILY_LIMITS;
    /**
     * 获取指定角色的默认配额
     */
    private static getDailyLimitForRole;
    private static resolveUserRole;
    private static isSameCalendarDay;
    private static normalizeQuotaState;
    private static findUserByDeviceId;
    /**
     * 获取当前设备归属的用户。
     * 如果没有用户，则创建游客账号，默认每日 5 次额度。
     * 如果已存在用户，则根据角色自动修正 dailyLimit，并做跨天重置。
     */
    static getOrCreateGuest(deviceId: string): Promise<PlatformUserRecord>;
    /**
     * 将游客账号升级为注册账号，并合并该设备下已有的历史数据。
     * - 游客默认升级为 REGISTERED
     * - 如果手机号/邮箱已对应到现有注册账号，则把游客历史合并到该账号
     * - 升级后每日额度自动提升到 10 次
     */
    static upgradeToRegisteredUser(deviceId: string, phone?: string, email?: string): Promise<any>;
    /**
     * 扣除额度（在调用 submit_and_evaluate 算出结果后触发）
     * 使用原子 SQL 操作，避免并发下的额度穿透。
     */
    static consumeQuota(deviceId: string): Promise<boolean>;
    /**
     * 检查剩余额度
     */
    static getRemainingQuota(deviceId: string): Promise<number>;
}
export {};
