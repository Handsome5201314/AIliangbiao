/**
 * AI Prompt 缓存模块
 * 
 * 功能：
 * 1. 缓存相似问题的 AI 响应
 * 2. 减少 Token 消耗
 * 3. 提升响应速度
 */

import { createHash } from 'crypto';

// 缓存项接口
interface CachedPrompt {
  prompt: string;
  context: string;
  response: string;
  timestamp: number;
  hitCount: number;
}

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 50,            // 最大缓存条数
  expirationTime: 3600000, // 过期时间：1小时（毫秒）
  similarityThreshold: 0.8, // 相似度阈值
};

// 内存缓存（生产环境应使用 Redis）
const promptCache = new Map<string, CachedPrompt>();

/**
 * 生成 Prompt 指纹
 */
function generatePromptHash(
  userMessage: string,
  context: any,
  scaleId?: string
): string {
  // 标准化消息
  const normalizedMessage = userMessage.toLowerCase().trim();
  
  // 提取关键特征
  const features = [
    normalizedMessage,
    context.symptoms?.length?.toString() || '0',
    context.state || 'initial',
    scaleId || '',
  ];
  
  // 生成哈希
  const hash = createHash('md5')
    .update(features.join('|'))
    .digest('hex');
  
  return hash;
}

/**
 * 计算文本相似度（简化版 Jaccard 相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * 查找相似问题的缓存响应
 */
function findSimilarCachedResponse(
  userMessage: string,
  context: any
): string | null {
  let bestMatch: CachedPrompt | null = null;
  let bestSimilarity = 0;
  
  for (const cached of promptCache.values()) {
    // 检查上下文是否匹配
    if (cached.context !== context.state) continue;
    
    // 计算相似度
    const similarity = calculateSimilarity(userMessage, cached.prompt);
    
    if (similarity > bestSimilarity && similarity >= CACHE_CONFIG.similarityThreshold) {
      bestSimilarity = similarity;
      bestMatch = cached;
    }
  }
  
  if (bestMatch) {
    console.log('[Prompt Cache] Similar match found:', {
      similarity: bestSimilarity.toFixed(2),
      hitCount: bestMatch.hitCount,
    });
    
    bestMatch.hitCount++;
    return bestMatch.response;
  }
  
  return null;
}

/**
 * 从缓存获取响应
 */
export function getCachedResponse(
  userMessage: string,
  context: any,
  scaleId?: string
): string | null {
  // 清理过期缓存
  cleanExpiredCache();
  
  // 1. 尝试精确匹配
  const hash = generatePromptHash(userMessage, context, scaleId);
  const exactMatch = promptCache.get(hash);
  
  if (exactMatch && Date.now() - exactMatch.timestamp < CACHE_CONFIG.expirationTime) {
    exactMatch.hitCount++;
    console.log('[Prompt Cache] Exact match:', hash);
    return exactMatch.response;
  }
  
  // 2. 尝试相似匹配
  const similarMatch = findSimilarCachedResponse(userMessage, context);
  
  if (similarMatch) {
    return similarMatch;
  }
  
  return null;
}

/**
 * 缓存响应
 */
export function setCachedResponse(
  userMessage: string,
  context: any,
  response: string,
  scaleId?: string
): void {
  const hash = generatePromptHash(userMessage, context, scaleId);
  
  // 限制缓存大小（LFU 策略）
  if (promptCache.size >= CACHE_CONFIG.maxSize) {
    // 删除最少使用的条目
    let minHitCount = Infinity;
    let minKey = '';
    
    for (const [key, value] of promptCache.entries()) {
      if (value.hitCount < minHitCount) {
        minHitCount = value.hitCount;
        minKey = key;
      }
    }
    
    if (minKey) {
      promptCache.delete(minKey);
      console.log('[Prompt Cache] Evicted:', minKey);
    }
  }
  
  promptCache.set(hash, {
    prompt: userMessage,
    context: context.state || 'initial',
    response,
    timestamp: Date.now(),
    hitCount: 0,
  });
  
  console.log('[Prompt Cache] Cached:', hash, 'Size:', promptCache.size);
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, item] of promptCache.entries()) {
    if (now - item.timestamp >= CACHE_CONFIG.expirationTime) {
      promptCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log('[Prompt Cache] Cleaned:', cleanedCount, 'items');
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  avgHitCount: number;
  totalHits: number;
} {
  let totalHits = 0;
  
  for (const item of promptCache.values()) {
    totalHits += item.hitCount;
  }
  
  return {
    size: promptCache.size,
    maxSize: CACHE_CONFIG.maxSize,
    avgHitCount: promptCache.size > 0 ? totalHits / promptCache.size : 0,
    totalHits,
  };
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  promptCache.clear();
  console.log('[Prompt Cache] Cleared');
}

/**
 * 预加载常见场景（可选）
 */
export function preloadCommonScenarios(): void {
  const commonScenarios = [
    {
      message: '孩子不爱说话',
      context: { state: 'initial', symptoms: [] },
      response: '我理解您的担心。他是在家也这样吗？',
    },
    {
      message: '好的开始吧',
      context: { state: 'consent', symptoms: ['不爱说话'] },
      response: '好的，马上为您开启评估。[SCALE:ABC]',
    },
  ];
  
  commonScenarios.forEach(scenario => {
    setCachedResponse(
      scenario.message,
      scenario.context,
      scenario.response
    );
  });
  
  console.log('[Prompt Cache] Preloaded', commonScenarios.length, 'scenarios');
}

// 导出缓存实例（用于调试）
export { promptCache };
