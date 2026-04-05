/**
 * 数据库查询缓存模块
 * 
 * 功能：
 * 1. 缓存查询结果
 * 2. 减少 database 查询
 * 3. 提升响应速度
 */

// 缓存项接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 200,        // 最大缓存条数
  defaultTTL: 60000,   // 默认过期时间：1分钟
  cleanupInterval: 300000, // 清理间隔：5分钟
};

// 内存缓存（生产环境应使用 Redis）
const cache = new Map<string, CacheItem<any>>();

// 定期清理过期缓存
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * 初始化缓存清理任务
 */
export function initQueryCache(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  
  cleanupTimer = setInterval(() => {
    cleanExpiredCache();
  }, CACHE_CONFIG.cleanupInterval);
  
  console.log('[Query Cache] Initialized');
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, item] of cache.entries()) {
    if (now - item.timestamp >= item.ttl) {
      cache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log('[Query Cache] Cleaned:', cleanedCount, 'items');
  }
}

/**
 * 生成缓存键
 */
function generateCacheKey(
  table: string,
  operation: string,
  params: any
): string {
  const paramsStr = JSON.stringify(params);
  const hash = simpleHash(paramsStr);
  return `${table}:${operation}:${hash}`;
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): string {
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * 从缓存获取或执行查询
 */
export async function cachedQuery<T>(
  table: string,
  operation: string,
  params: any,
  queryFn: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T> {
  const key = generateCacheKey(table, operation, params);
  const cached = cache.get(key);
  
  // 缓存命中
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log('[Query Cache] Hit:', key);
    return cached.data;
  }
  
  // 缓存未命中，执行查询
  console.log('[Query Cache] Miss:', key);
  
  const startTime = Date.now();
  const data = await queryFn();
  const queryTime = Date.now() - startTime;
  
  console.log('[Query Cache] Query time:', `${queryTime}ms`);
  
  // 限制缓存大小（LRU 策略）
  if (cache.size >= CACHE_CONFIG.maxSize) {
    // 删除最旧的条目
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  // 保存到缓存
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
  
  return data;
}

/**
 * 清除指定表的缓存
 */
export function invalidateTableCache(table: string): void {
  let count = 0;
  
  for (const key of cache.keys()) {
    if (key.startsWith(`${table}:`)) {
      cache.delete(key);
      count++;
    }
  }
  
  console.log('[Query Cache] Invalidated:', table, 'Count:', count);
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  cache.clear();
  console.log('[Query Cache] Cleared all');
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
  tables: Record<string, number>;
} {
  const tables: Record<string, number> = {};
  
  for (const key of cache.keys()) {
    const table = key.split(':')[0];
    tables[table] = (tables[table] || 0) + 1;
  }
  
  return {
    size: cache.size,
    maxSize: CACHE_CONFIG.maxSize,
    hitRate: 0, // 需要在实际使用中统计
    tables,
  };
}

/**
 * 便捷方法：缓存用户查询
 */
export async function getCachedUser(
  userId: string,
  queryFn: () => Promise<any>
): Promise<any> {
  return cachedQuery('User', 'findUnique', { userId }, queryFn, 60000);
}

/**
 * 便捷方法：缓存评估历史查询
 */
export async function getCachedAssessments(
  userId: string,
  limit: number = 10,
  queryFn: () => Promise<any[]>
): Promise<any[]> {
  return cachedQuery(
    'AssessmentHistory',
    'findMany',
    { userId, limit },
    queryFn,
    30000
  );
}

/**
 * 便捷方法：缓存分诊会话查询
 */
export async function getCachedSession(
  userId: string,
  status: string,
  queryFn: () => Promise<any>
): Promise<any> {
  return cachedQuery(
    'TriageSession',
    'findFirst',
    { userId, status },
    queryFn,
    30000
  );
}

/**
 * 便捷方法：缓存 API Key 查询
 */
export async function getCachedApiKey(
  serviceType: string,
  isActive: boolean,
  queryFn: () => Promise<any>
): Promise<any> {
  return cachedQuery(
    'ApiKey',
    'findFirst',
    { serviceType, isActive },
    queryFn,
    120000 // 2分钟缓存
  );
}

// 自动初始化
if (typeof window === 'undefined') {
  initQueryCache();
}

// 导出缓存实例（用于调试）
export { cache };
