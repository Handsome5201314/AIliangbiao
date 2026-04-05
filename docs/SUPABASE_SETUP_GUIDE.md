# 🚀 Supabase 连接配置完整指南

## 📋 目录
1. [注册 Supabase 账号](#步骤-1注册-supabase-账号)
2. [创建新项目](#步骤-2创建新项目)
3. [获取数据库连接信息](#步骤-3获取数据库连接信息)
4. [配置环境变量](#步骤-4配置环境变量)
5. [初始化数据库](#步骤-5初始化数据库)
6. [测试连接](#步骤-6测试连接)

---

## 步骤 1：注册 Supabase 账号

### 方法一：官网注册

1. 访问 Supabase 官网：**https://supabase.com**
2. 点击右上角 **"Start your project"** 按钮
3. 选择登录方式：
   - 使用 GitHub 账号登录（推荐）
   - 使用 Google 账号登录
   - 使用邮箱注册

### 方法二：直接访问登录页

直接访问：**https://app.supabase.com**

---

## 步骤 2：创建新项目

### 2.1 创建组织（首次使用）

如果您是第一次使用，需要先创建组织：

1. 登录后会看到 **"Create an organization"** 页面
2. 填写组织信息：
   - **Organization name**: 您的组织名称（如：`My Projects`）
   - **Plan**: 选择 `Free` 免费计划
3. 点击 **"Create organization"**

### 2.2 创建项目

1. 点击 **"New project"** 按钮
2. 填写项目信息：
   - **Name**: `ai-scale-system`（或您喜欢的名称）
   - **Database Password**: 设置数据库密码（**请记住此密码**）
     - 建议：使用强密码，如 `AiScale2026!`
   - **Region**: 选择离您最近的区域
     - 推荐选择：`Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`
     - 国内访问：Tokyo 或 Singapore 速度较快
   - **Plan**: 确认选择 `Free`
3. 点击 **"Create new project"**
4. 等待约 2 分钟，项目初始化完成

**⚠️ 重要提示：**
- 请务必保存好数据库密码，后续无法再次查看
- 建议将密码保存到安全的地方

---

## 步骤 3：获取数据库连接信息

### 3.1 进入项目设置

1. 项目创建完成后，进入项目 Dashboard
2. 点击左侧菜单的 **"⚙️ Settings"** 图标
3. 选择 **"Database"** 选项

### 3.2 获取连接字符串

在 Database 设置页面，找到 **"Connection string"** 部分：

#### 方法一：使用 URI 格式（推荐）

1. 选择 **"URI"** 标签
2. 选择 **"Mode: Session"**（默认）
3. 复制连接字符串，格式如下：
   ```
   postgresql://postgres.[项目ID]:[密码]@aws-0-[区域].pooler.supabase.com:5432/postgres
   ```

**示例：**
```
postgresql://postgres.abcdefghijk:YourPassword@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

#### 方法二：使用 JDBC 格式（Java应用）

如果需要 JDBC 格式，选择 **"JDBC"** 标签。

### 3.3 记录关键信息

请记录以下信息（后续需要）：

| 信息项 | 说明 | 示例 |
|--------|------|------|
| 项目ID | 在连接字符串中 | `abcdefghijk` |
| 数据库密码 | 您设置的密码 | `AiScale2026!` |
| 区域 | 服务器所在区域 | `ap-southeast-1` |
| 完整连接字符串 | 完整的URI | 见上文示例 |

---

## 步骤 4：配置环境变量

### 4.1 创建 .env 文件

在项目根目录创建 `.env` 文件（如果已存在则修改）：

```bash
# Supabase PostgreSQL 数据库连接
DATABASE_URL="postgresql://postgres.[您的项目ID]:[您的密码]@aws-0-[区域].pooler.supabase.com:5432/postgres"

# 应用配置
NEXT_PUBLIC_API_URL="http://localhost:3000"

# Supabase 配置（可选，用于后续集成更多功能）
NEXT_PUBLIC_SUPABASE_URL="https://[您的项目ID].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[从项目设置中获取]"
```

### 4.2 获取 Supabase Anon Key（可选）

如果您计划使用 Supabase 的其他功能（如认证、存储）：

1. 在项目 Dashboard，点击 **"⚙️ Settings"**
2. 选择 **"API"** 选项
3. 找到 **"Project API keys"**
4. 复制 **"anon public"** key

### 4.3 安全提示

**⚠️ 重要：**

- ✅ `.env` 文件已添加到 `.gitignore`，不会被提交到 Git
- ✅ 数据库密码不会被泄露
- ✅ 生产环境请使用环境变量管理平台（如 Vercel、Railway）

---

## 步骤 5：初始化数据库

### 5.1 生成 Prisma 客户端

```bash
npx prisma generate
```

### 5.2 推送数据库模型到 Supabase

```bash
npx prisma db push
```

**预期输出：**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-..."

Your database is now in sync with your Prisma schema.

✔ Generated Prisma Client
```

### 5.3 查看数据库表

推送成功后，您可以：

1. 回到 Supabase Dashboard
2. 点击左侧菜单 **"Table Editor"**
3. 您应该能看到以下表：
   - ✅ `User`
   - ✅ `ChildProfile`
   - ✅ `AssessmentHistory`
   - ✅ `McpLog`

---

## 步骤 6：测试连接

### 6.1 启动开发服务器

```bash
npm run dev
```

### 6.2 测试功能

访问 `http://localhost:3000`，测试：

1. **用户建档**
   - 填写宝宝信息
   - 检查 Supabase Dashboard 是否有新记录

2. **量表评估**
   - 完成一次评估
   - 检查 `AssessmentHistory` 表

3. **查看数据**
   - 在 Supabase Dashboard 的 Table Editor 中
   - 应该能看到刚才创建的数据

### 6.3 使用 Prisma Studio 查看数据

```bash
npx prisma studio
```

这将打开 Prisma Studio（数据库可视化管理界面）：
- 自动打开浏览器 `http://localhost:5555`
- 可以查看和编辑所有数据
- 支持筛选、排序、搜索

---

## 🔧 常见问题排查

### 问题 1：连接超时

**错误信息：** `Can't reach database server`

**解决方案：**
1. 检查 `.env` 文件中的 `DATABASE_URL` 是否正确
2. 确认密码中没有特殊字符导致解析错误
3. 检查网络连接，确保能访问 Supabase

### 问题 2：密码错误

**错误信息：** `P1000: Authentication failed against database server`

**解决方案：**
1. 确认密码正确（检查是否有多余空格）
2. 如果密码包含特殊字符，需要 URL 编码：
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`

### 问题 3：SSL 连接问题

**错误信息：** `SSL connection required`

**解决方案：**

在 `DATABASE_URL` 末尾添加 SSL 参数：

```
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
```

或使用直连（不推荐，可能暴露数据库）：

```
DATABASE_URL="postgresql://...?sslmode=require"
```

---

## 📊 Supabase 免费额度

| 资源 | 免费额度 |
|------|---------|
| 数据库存储 | 500 MB |
| 文件存储 | 1 GB |
| 带宽 | 5 GB/月 |
| API 请求 | 无限制 |
| 并发连接 | 60 个 |

**注意：**
- AI 量表系统初期完全够用
- 超出额度后需要升级到 Pro 计划（$25/月）

---

## 🎯 后续优化建议

### 1. 配置自动备份

1. 进入 Supabase Dashboard
2. Settings → Database → Backups
3. 启用每日自动备份（免费计划包含7天备份）

### 2. 设置数据库监控

1. Settings → Logs
2. 查看数据库查询日志
3. 监控慢查询

### 3. 优化连接池

在 `lib/db/prisma.ts` 中优化连接配置：

```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
```

---

## ✅ 完成检查清单

完成以下步骤后，您的 Supabase 连接就配置好了：

- [ ] 注册 Supabase 账号
- [ ] 创建新项目
- [ ] 记录数据库密码和项目ID
- [ ] 获取连接字符串
- [ ] 配置 `.env` 文件
- [ ] 运行 `npx prisma generate`
- [ ] 运行 `npx prisma db push`
- [ ] 在 Supabase Dashboard 确认表已创建
- [ ] 启动项目测试功能

---

## 🆘 需要帮助？

如果遇到问题：

1. **查看日志：** 检查终端输出的错误信息
2. **Supabase 文档：** https://supabase.com/docs
3. **Prisma 文档：** https://www.prisma.io/docs
4. **社区支持：** Supabase Discord 或 GitHub Discussions

---

**🎉 恭喜！完成以上步骤后，您的 AI 量表系统就成功连接到 Supabase 了！**
