/**
 * 语音识别缓存模块
 * 
 * 功能：
 * 1. 缓存常用短语识别结果
 * 2. 减少 API 调用次数
 * 3. 提升响应速度
 */

// 缓存项接口
interface CacheItem {
  transcript: string;
  confidence: number;
  timestamp: number;
  audioHash: string;
}

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 100,           // 最大缓存条数
  expirationTime: 3600000, // 过期时间：1小时（毫秒）
  minConfidence: 0.85,    // 最低置信度阈值
};

// 内存缓存（生产环境应使用 Redis）
const cache = new Map<string, CacheItem>();

// 常用短语库（用于快速匹配）
const COMMON_PHRASES = new Map([
  // 确认类
  ['好的', '好的'],
  ['可以', '可以'],
  ['行', '行'],
  ['是的', '是的'],
  ['对', '对'],
  ['没问题', '没问题'],
  ['开始吧', '开始吧'],
  ['开始', '开始'],
  
  // 否定类
  ['不是', '不是'],
  ['不对', '不对'],
  ['不行', '不行'],
  ['没有', '没有'],
  
  // 量表选项（SNAP-IV）
  ['无', '无'],
  ['有一点点', '有一点点'],
  ['还算不少', '还算不少'],
  ['非常多', '非常多'],
  
  // 量表选项（ABC/CARS）
  ['从不', '从不'],
  ['偶尔', '偶尔'],
  ['经常', '经常'],
  ['总是', '总是'],
  ['是', '是'],
  ['否', '否'],
]);

/**
 * 生成音频指纹（简化版）
 * 实际项目应使用音频特征提取算法
 */
export function generateAudioHash(audioBlob: Blob): string {
  // 基于文件大小和类型生成简单哈希
  // 生产环境应使用更精确的音频指纹算法
  const size = audioBlob.size;
  const type = audioBlob.type;
  
  // 简单哈希函数
  const hash = `${type}-${size}`;
  
  return hash;
}

/**
 * 从缓存获取识别结果
 */
export function getCachedTranscript(audioHash: string): CacheItem | null {
  // 清理过期缓存
  cleanExpiredCache();
  
  const cached = cache.get(audioHash);
  
  if (cached) {
    // 检查是否过期
    if (Date.now() - cached.timestamp < CACHE_CONFIG.expirationTime) {
      console.log('[Cache] Hit:', audioHash);
      return cached;
    } else {
      // 移除过期项
      cache.delete(audioHash);
    }
  }
  
  return null;
}

/**
 * 保存识别结果到缓存
 */
export function setCachedTranscript(
  audioHash: string,
  transcript: string,
  confidence: number
): void {
  // 只缓存高置信度的结果
  if (confidence < CACHE_CONFIG.minConfidence) {
    console.log('[Cache] Skip: Low confidence');
    return;
  }
  
  // 限制缓存大小（LRU 策略）
  if (cache.size >= CACHE_CONFIG.maxSize) {
    // 删除最旧的条目
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  cache.set(audioHash, {
    transcript,
    confidence,
    timestamp: Date.now(),
    audioHash,
  });
  
  console.log('[Cache] Set:', audioHash, 'Size:', cache.size);
}

/**
 * 快速匹配常用短语
 * 直接返回预定义的识别结果，无需调用 API
 */
export function quickMatchPhrase(text: string): string | null {
  // 标准化文本（去除空格、标点）
  const normalizedText = text.replace(/[\s\.,，。！!？?]/g, '').trim();
  
  // 匹配常用短语
  for (const [pattern, result] of COMMON_PHRASES.entries()) {
    if (normalizedText === pattern || normalizedText.includes(pattern)) {
      console.log('[Cache] Quick match:', pattern, '→', result);
      return result;
    }
  }
  
  return null;
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, item] of cache.entries()) {
    if (now - item.timestamp >= CACHE_CONFIG.expirationTime) {
      cache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log('[Cache] Cleaned:', cleanedCount, 'items');
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
  oldestItem: number | null;
} {
  let oldestTimestamp: number | null = null;
  
  for (const item of cache.values()) {
    if (oldestTimestamp === null || item.timestamp < oldestTimestamp) {
      oldestTimestamp = item.timestamp;
    }
  }
  
  return {
    size: cache.size,
    maxSize: CACHE_CONFIG.maxSize,
    hitRate: 0, // 需要在实际使用中统计
    oldestItem: oldestTimestamp,
  };
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  cache.clear();
  console.log('[Cache] Cleared');
}

/**
 * 预加载常用短语（可选）
 * 在应用启动时调用，提升首次匹配速度
 */
export function preloadCommonPhrases(): void {
  console.log('[Cache] Preloaded', COMMON_PHRASES.size, 'common phrases');
}

// 导出缓存实例（用于调试）
export { cache };
