# 🚀 AI 量表系统 - 生产部署指南

## 📋 部署前检查清单

### ✅ 已完成的优化

- [x] 清理本地构建缓存与临时日志（如 `.next/`、`.tmp-*`）
- [x] 删除一次性测试与分析产物（如 `test_agent_integration.mjs`、`tmp_*`）
- [x] 删除历史备份组件与非必要生成物（如 `*.old.tsx`、`tsconfig.tsbuildinfo`）
- [x] 保留部署脚本、运维文档与环境模板，便于重复交付
- [x] 构建测试通过（无错误）
- [x] TypeScript 类型检查通过

### 📦 项目文件结构

```
AI量表系统/
├── app/                    # Next.js 应用路由
├── components/             # React 组件
├── contexts/               # React Context
├── lib/                    # 核心库文件
├── prisma/                 # 数据库 Schema
├── scripts/                # 部署脚本
├── types/                  # TypeScript 类型定义
├── .env.example            # 环境变量模板
├── package.json            # 依赖配置
├── next.config.js          # Next.js 配置
├── tsconfig.json           # TypeScript 配置
└── tailwind.config.ts      # Tailwind CSS 配置
```

---

## 🌐 服务器部署步骤

### 1️⃣ 上传代码到服务器

在本地 PowerShell 执行：

```powershell
cd "C:\Users\lishuaishuai\Desktop\AI量表系统"

# 清理服务器旧代码
ssh root@136.110.9.74 "rm -rf ~/AIliangbiao"

# 创建目录
ssh root@136.110.9.74 "mkdir -p ~/AIliangbiao"

# 上传所有文件（排除 node_modules 和 .next）
scp -r * root@136.110.9.74:~/AIliangbiao/

# 密码: kId8r69XoXM1i07TzWZ7
```

---

### 2️⃣ 服务器端配置

SSH 登录服务器：

```bash
ssh root@136.110.9.74
cd ~/AIliangbiao
```

#### 2.1 配置 `.env` 文件

```bash
cat > .env << 'EOF'
# ============================================
# 数据库配置（服务器本地 PostgreSQL）
# ============================================
DATABASE_URL="postgresql://postgres@localhost:5432/ai_scale_db"
DIRECT_URL="postgresql://postgres@localhost:5432/ai_scale_db"

# ============================================
# 应用配置
# ============================================
NEXT_PUBLIC_APP_URL="http://ailiangbiao.agentpit.io"
NEXT_PUBLIC_API_URL="http://ailiangbiao.agentpit.io"
NEXT_PUBLIC_APP_NAME="AI 量表系统"

# Session Secret（请修改为随机字符串）
SESSION_SECRET="your-random-secret-key-change-me-in-production"

# AgentPit 平台接入
AGENTPIT_SHARED_BEARER="change-me-to-a-long-random-bearer"
AGENTPIT_CLIENT_ID=""
AGENTPIT_CLIENT_SECRET=""
AGENTPIT_OAUTH_BASE_URL="https://api.agentpit.io"
AGENTPIT_OAUTH_REDIRECT_URI="https://ailiangbiao.agentpit.io/api/agentpit/oauth/callback"

# ============================================
# 管理员配置
# ============================================
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password"

# ============================================
# AI 服务配置（可选）
# ============================================
DEEPSEEK_API_KEY=""
TENCENT_SECRET_ID=""
TENCENT_SECRET_KEY=""
TENCENT_SPEECH_SECRET_ID=""
TENCENT_SPEECH_SECRET_KEY=""

# ============================================
# 功能开关
# ============================================
ENABLE_VOICE_INTERACTION="true"
ENABLE_MCP_SERVER="true"

# ============================================
# 性能/日志
# ============================================
CACHE_TTL="3600"
MAX_CACHE_SIZE="1000"
LOG_LEVEL="info"
EOF
```


#### 2.2 运行部署脚本

```bash
chmod +x scripts/deploy-with-domain.sh
./scripts/deploy-with-domain.sh
```

---

### 3️⃣ 验证部署

访问以下地址验证：

- 🏠 **首页**: http://ailiangbiao.agentpit.io
- 🔐 **管理后台**: http://ailiangbiao.agentpit.io/admin/login
- 🏥 **健康检查**: http://ailiangbiao.agentpit.io/healthz
- 📘 **OpenAPI**: http://ailiangbiao.agentpit.io/openapi.json
- 🤖 **Agent 工作台**: http://ailiangbiao.agentpit.io/agent

---

## ⚙️ 环境变量说明

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://postgres@localhost:5432/ai_scale_db` |
| `SESSION_SECRET` | 会话加密密钥 | 随机 32 位以上字符串 |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | 强密码 |
| `AGENTPIT_SHARED_BEARER` | AgentPit 调用公开量表 Agent 的共享 Bearer | 长随机字符串 |
| `AGENTPIT_CLIENT_ID` | AgentPit OAuth Client ID | 控制台生成 |
| `AGENTPIT_CLIENT_SECRET` | AgentPit OAuth Client Secret | 控制台生成 |

### 可选配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek AI 密钥 | 空 |
| `TENCENT_SECRET_ID` | 腾讯云 API ID | 空 |
| `TENCENT_SECRET_KEY` | 腾讯云 API Key | 空 |
| `ENABLE_VOICE_INTERACTION` | 启用语音交互 | `true` |
| `ENABLE_MCP_SERVER` | 启用 MCP 服务器 | `true` |
| `AGENTPIT_OAUTH_BASE_URL` | AgentPit OAuth 基础地址 | `https://api.agentpit.io` |
| `AGENTPIT_OAUTH_REDIRECT_URI` | AgentPit OAuth 回调地址 | `https://ailiangbiao.agentpit.io/api/agentpit/oauth/callback` |

---

## 🔒 安全建议

### 1. 修改默认密码

```bash
# 修改 .env 中的管理员密码
ADMIN_PASSWORD="Strong@Password#2026"
```

### 2. 设置 Session Secret

```bash
# 生成随机密钥
openssl rand -base64 32

# 更新 .env
SESSION_SECRET="生成的随机密钥"
```

### 3. 启用 HTTPS（推荐）

部署脚本会自动配置 Let's Encrypt SSL 证书。

### 4. 配置防火墙

```bash
# 只开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 5432/tcp  # PostgreSQL（可选，本地访问不需要）
ufw enable
```

---

## 📊 性能优化建议

### 1. 启用 Redis 缓存（可选）

```env
REDIS_URL="redis://localhost:6379"
```

### 2. 配置 CDN（可选）

将静态资源上传到 CDN 加速访问。

### 3. 数据库优化

```bash
# 定期清理日志
psql -d ai_scale_db -c "DELETE FROM \"ConversationHistory\" WHERE \"createdAt\" < NOW() - INTERVAL '30 days';"

# 重建索引
psql -d ai_scale_db -c "REINDEX DATABASE ai_scale_db;"
```

---

## 🛠️ 常见问题

### Q1: 构建失败？

```bash
# 清理并重新构建
rm -rf .next node_modules
npm install
npm run build
```

### Q2: 数据库连接失败？

```bash
# 检查 PostgreSQL 状态
systemctl status postgresql

# 测试连接
psql -h localhost -U postgres -d ai_scale_db -c "SELECT 1;"
```

### Q3: 端口被占用？

```bash
# 查看端口占用
netstat -tlnp | grep :3000

# 杀死进程
kill -9 <PID>
```

### Q4: Nginx 配置错误？

```bash
# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

---

## 📞 技术支持

- 📧 Email: support@example.com
- 📖 文档: https://docs.example.com
- 🐛 问题反馈: https://github.com/example/ai-scale/issues

---

## 📅 更新日志

### v1.0.0 (2026-04-06)
- ✅ 完成生产环境部署优化
- ✅ 修复所有 TypeScript 类型错误
- ✅ 清理开发测试文件
- ✅ 优化数据库连接配置
- ✅ 增强安全性（密码管理）
