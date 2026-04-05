# 🎉 AI量表系统 - 核心功能修复完成指南

## ✅ 已完成的修复内容

### 1. **评估结果持久化** ✅
- ✅ 创建了 `/api/assessment/save` 接口
- ✅ 修改了 Questionnaire 组件调用保存 API
- ✅ 实现了额度检查和扣减逻辑
- ✅ 更新了 completedScales 状态

### 2. **用户画像同步** ✅
- ✅ 创建了 `/api/profile/sync` 接口（支持 POST 和 GET）
- ✅ 修改了 ProfileContext 实现数据库同步
- ✅ 页面加载时优先从数据库加载画像
- ✅ 更新画像时自动同步到数据库

### 3. **额度管理** ✅
- ✅ 创建了 `/api/quota/check` 接口
- ✅ 首页显示剩余额度信息
- ✅ 实现了 deviceId 自动生成和管理
- ✅ 额度不足时阻止评估

---

## 🚀 部署前的必要步骤

### **步骤 1：配置环境变量**

创建 `.env` 文件（基于 `.env.example`）：

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 `.env` 文件，填入您的数据库连接信息：

\`\`\`env
DATABASE_URL="postgresql://你的用户名:你的密码@你的主机:5432/ai_scale"
\`\`\`

### **步骤 2：初始化数据库**

\`\`\`bash
# 生成 Prisma 客户端
npx prisma generate

# 推送数据库模型（开发环境）
npx prisma db push

# 或创建迁移文件（生产环境推荐）
npx prisma migrate dev --name init
\`\`\`

### **步骤 3：启动开发服务器**

\`\`\`bash
npm run dev
\`\`\`

---

## 🧪 测试流程

### **测试 1：首次建档**

1. 打开 `http://localhost:3000`
2. 应自动弹出建档弹窗
3. 填写宝宝信息（昵称、性别、月龄）
4. 点击"生成专属守护者"
5. ✅ 检查 localStorage 是否保存画像
6. ✅ 检查数据库 ChildProfile 表是否有记录

**验证 SQL：**
\`\`\`sql
SELECT * FROM "ChildProfile" ORDER BY "createdAt" DESC LIMIT 1;
\`\`\`

### **测试 2：量表评估**

1. 在首页选择任意量表卡片
2. 完成所有题目的答题
3. 观察保存中的状态提示
4. ✅ 检查是否显示"评估完成"
5. ✅ 检查数据库 AssessmentHistory 表
6. ✅ 检查头像是否戴上虎头帽

**验证 SQL：**
\`\`\`sql
SELECT * FROM "AssessmentHistory" ORDER BY "createdAt" DESC LIMIT 1;
SELECT * FROM "User" WHERE "deviceId" IS NOT NULL;
\`\`\`

### **测试 3：额度管理**

1. 刷新首页
2. ✅ 检查右上角是否显示"今日剩余：1/1 次"
3. 完成一次评估后
4. ✅ 检查额度是否变为"今日剩余：0/1 次"
5. 尝试再次评估
6. ✅ 应提示"额度不足"

**验证 SQL：**
\`\`\`sql
SELECT "dailyUsed", "dailyLimit" FROM "User" WHERE "deviceId" IS NOT NULL;
\`\`\`

### **测试 4：跨设备同步**

1. 打开浏览器 A，建档并完成评估
2. 复制 localStorage 中的 `device_id`
3. 打开浏览器 B（无痕模式）
4. 手动设置相同的 `device_id`：
   \`\`\`javascript
   localStorage.setItem('device_id', '你的deviceId');
   \`\`\`
5. 刷新页面
6. ✅ 应自动加载之前的画像信息

---

## 📊 数据库表结构验证

### **User 表**
\`\`\`sql
-- 查看所有游客用户
SELECT id, "deviceId", "dailyUsed", "dailyLimit", "isGuest", "lastResetAt" 
FROM "User" 
WHERE "isGuest" = true;
\`\`\`

### **ChildProfile 表**
\`\`\`sql
-- 查看儿童画像
SELECT id, nickname, gender, "ageMonths", traits, "avatarConfig"
FROM "ChildProfile";
\`\`\`

### **AssessmentHistory 表**
\`\`\`sql
-- 查看评估历史
SELECT id, "userId", "scaleId", "totalScore", conclusion, answers, "createdAt"
FROM "AssessmentHistory"
ORDER BY "createdAt" DESC;
\`\`\`

---

## 🔧 常见问题排查

### **问题 1：数据库连接失败**

**错误信息：** `Can't reach database server at ...`

**解决方案：**
1. 检查 PostgreSQL 服务是否启动
2. 验证 `.env` 中的 `DATABASE_URL` 是否正确
3. 确认数据库已创建：`createdb ai_scale`
4. 测试连接：`npx prisma db pull`

### **问题 2：评估保存失败**

**错误信息：** `额度不足` 或 `保存失败`

**解决方案：**
1. 检查 User 表的 `dailyUsed` 和 `dailyLimit`
2. 确认 deviceId 已正确生成
3. 查看浏览器控制台的网络请求
4. 检查服务端日志

### **问题 3：画像未同步**

**现象：** 换设备后画像丢失

**解决方案：**
1. 检查 `/api/profile/sync` 接口是否正常
2. 验证 deviceId 是否一致
3. 查看 ChildProfile 表是否有记录

---

## 🎯 后续优化建议

### **短期优化（1-2周）**

1. **额度重置定时任务**
   - 创建 Cron Job 每日凌晨重置 `dailyUsed`
   - 或在 QuotaManager 中增加实时检查

2. **历史记录查看页面**
   - 创建 `/history` 路由
   - 展示评估历史列表和详情

3. **错误边界处理**
   - 添加全局错误边界组件
   - 优化错误提示 UI

### **中期优化（1个月）**

1. **用户注册登录**
   - 实现手机号注册
   - 升级额度策略

2. **MCP Agent 集成**
   - 完善外部 Agent 调用接口
   - 实现 AI 辅助分诊

3. **数据分析和报表**
   - 创建管理后台
   - 实现统计图表

---

## 📝 API 文档

### **POST /api/assessment/save**

保存评估结果

**请求体：**
\`\`\`json
{
  "deviceId": "uuid-string",
  "scaleId": "ABC",
  "totalScore": 53.5,
  "conclusion": "边缘/疑似界限",
  "answers": [1, 2, 3, 4, 1, 2, ...]
}
\`\`\`

**响应：**
\`\`\`json
{
  "success": true,
  "assessment": {
    "id": "cuid",
    "scaleId": "ABC",
    "totalScore": 53.5,
    "conclusion": "边缘/疑似界限",
    "createdAt": "2026-04-01T..."
  }
}
\`\`\`

### **POST /api/profile/sync**

同步用户画像

**请求体：**
\`\`\`json
{
  "deviceId": "uuid-string",
  "nickname": "明明",
  "gender": "boy",
  "ageMonths": 36,
  "interests": ["恐龙", "汽车"],
  "fears": ["打针"],
  "avatarConfig": {
    "mood": "happy",
    "clothing": "tang_suit",
    "headwear": "none"
  }
}
\`\`\`

### **GET /api/quota/check?deviceId={deviceId}**

查询剩余额度

**响应：**
\`\`\`json
{
  "remaining": 1,
  "dailyLimit": 1,
  "dailyUsed": 0,
  "isGuest": true
}
\`\`\`

---

## 🎊 恭喜！

核心功能修复已完成！现在您的系统已具备：

✅ 评估结果持久化存储  
✅ 用户画像跨设备同步  
✅ 完整的额度管理机制  
✅ 前后端完整数据流  

开始测试吧！如有任何问题，请参考上述排查指南。
