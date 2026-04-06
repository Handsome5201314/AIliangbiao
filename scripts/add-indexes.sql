-- 数据库索引优化脚本
-- 执行方式：在 Supabase SQL Editor 中运行

-- ==================== 1. 用户表索引 ====================

-- 设备ID + 最后重置时间（用于额度查询）
CREATE INDEX IF NOT EXISTS idx_user_device_reset 
ON "User"("deviceId", "lastResetAt");

-- 每日使用情况（用于额度检查）
CREATE INDEX IF NOT EXISTS idx_user_daily 
ON "User"("dailyUsed", "dailyLimit");

-- 创建时间（用于统计）
CREATE INDEX IF NOT EXISTS idx_user_created 
ON "User"("createdAt" DESC);

-- ==================== 2. 评估历史表索引 ====================

-- 用户ID + 创建时间（最常用查询：获取用户历史记录）
CREATE INDEX IF NOT EXISTS idx_assessment_user_date 
ON "AssessmentHistory"("userId", "createdAt" DESC);

-- 量表ID + 版本号（用于按量表类型统计）
CREATE INDEX IF NOT EXISTS idx_assessment_scale_version 
ON "AssessmentHistory"("scaleId", "scaleVersion");

-- 总分降序（用于分数排行榜）
CREATE INDEX IF NOT EXISTS idx_assessment_score 
ON "AssessmentHistory"("totalScore" DESC);

-- ==================== 3. 分诊会话表索引 ====================

-- 用户ID + 状态（最常用查询：获取活跃会话）
CREATE INDEX IF NOT EXISTS idx_session_user_status 
ON "TriageSession"("userId", status);

-- 更新时间降序（用于获取最新会话）
CREATE INDEX IF NOT EXISTS idx_session_updated 
ON "TriageSession"("updatedAt" DESC);

-- 状态 + 更新时间（用于过期清理）
CREATE INDEX IF NOT EXISTS idx_session_status_date 
ON "TriageSession"(status, "updatedAt" DESC);

-- ==================== 4. API Key 表索引 ====================

-- 服务类型 + 激活状态（最常用查询：获取活跃密钥）
CREATE INDEX IF NOT EXISTS idx_apikey_service_active 
ON "ApiKey"("serviceType", "isActive");

-- 提供商 + 激活状态（用于按提供商筛选）
CREATE INDEX IF NOT EXISTS idx_apikey_provider_active 
ON "ApiKey"("provider", "isActive");

-- 最后使用时间（用于轮询策略）
CREATE INDEX IF NOT EXISTS idx_apikey_last_used 
ON "ApiKey"("lastUsedAt" DESC);

-- 提供商 + 服务类型 + 激活状态（复合查询）
CREATE INDEX IF NOT EXISTS idx_apikey_provider_service_active 
ON "ApiKey"("provider", "serviceType", "isActive");

-- ==================== 5. 语音使用记录索引 ====================

-- 用户ID + 创建时间（用于用户使用统计）
CREATE INDEX IF NOT EXISTS idx_speech_user_date 
ON "SpeechUsage"("userId", "createdAt" DESC);

-- 提供商 + 创建时间（用于服务商统计）
CREATE INDEX IF NOT EXISTS idx_speech_provider_date 
ON "SpeechUsage"("provider", "createdAt" DESC);

-- ==================== 6. 儿童画像表索引 ====================

-- 用户ID（关联查询）
CREATE INDEX IF NOT EXISTS idx_profile_user 
ON "ChildProfile"("userId");

-- ==================== 7. 生长记录表索引 ====================

-- 画像ID + 月龄（用于生长曲线查询）
CREATE INDEX IF NOT EXISTS idx_growth_profile_age 
ON "GrowthRecord"("profileId", "ageMonths");

-- ==================== 验证索引创建 ====================

-- 查看所有索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ==================== 分析查询性能 ====================

-- 启用查询分析
EXPLAIN ANALYZE
SELECT * FROM "User" 
WHERE "deviceId" = 'test-device-id';

EXPLAIN ANALYZE
SELECT * FROM "AssessmentHistory" 
WHERE "userId" = 'user-id' 
ORDER BY "createdAt" DESC 
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM "TriageSession" 
WHERE "userId" = 'user-id' AND status = 'ONGOING';

EXPLAIN ANALYZE
SELECT * FROM "ApiKey" 
WHERE "serviceType" = 'text' AND "isActive" = true;
