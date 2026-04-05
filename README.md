<div align="center">

# 🧠 AI 量表系统

**智伴童行 - 儿童心理评估 AI 平台**

基于 4D 临床数据结构的智能心理量表评估系统，支持语音交互与多模态AI诊断

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[在线演示](#) | [快速开始](#-快速开始) | [功能特性](#-功能特性) | [API文档](docs/AGENT_SCALE_INTEGRATION_GUIDE.md) | [贡献指南](CONTRIBUTING.md)

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [技术架构](#-技术架构)
- [已支持量表](#-已支持量表)
- [快速开始](#-快速开始)
- [安装部署](#-安装部署)
- [使用指南](#-使用指南)
- [API文档](#-api文档)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)
- [致谢](#-致谢)

---

## 🌟 项目简介

**AI 量表系统**是一个创新的儿童心理评估平台，将传统医学量表转化为智能语音交互体验。通过 **4D 临床数据结构**，实现量表题目的口语化表达、智能追问和精准评分。

### 为什么选择 AI 量表系统？

- 🎯 **精准评估**：基于权威医学量表，支持自闭症、ADHD、焦虑等多种心理评估
- 🗣️ **语音交互**：支持语音答题，让家长像聊天一样完成评估
- 🔒 **隐私保护**：数据本地存储，符合医疗隐私合规要求
- 🤖 **AI 智能**：智能分诊、追问澄清、个性化建议
- 📊 **可视化报告**：自动生成专业评估报告和干预建议

---

## ✨ 功能特性

### 核心功能

#### 1. 智能分诊系统

- **症状收集**：通过自然对话收集家长的主诉和症状
- **量表推荐**：AI 自动推荐最合适的评估量表
- **断点续诊**：支持会话保存，随时继续评估

#### 2. 4D 临床数据结构

每个量表题目包含四个维度：

| 维度 | 说明 | 示例 |
|------|------|------|
| **D1 - 量表元信息** | 基本信息 | ID、名称、描述 |
| **D2 - 题目本体** | 学术原版 | "喜欢长时间的自身旋转" |
| **D3 - 临床意图与追问** | 智能交互 | 通俗表述、追问策略 |
| **D4 - 评分与结论** | 算分逻辑 | 分值、判定标准 |

#### 3. 多模态交互

- **语音输入**：支持语音答题，解放双手
- **语音播报**：题目自动朗读，适合视力不佳的家长
- **文本输入**：支持传统文本输入方式

#### 4. 可视化报告

- **评估结果**：总分、维度分、百分位
- **临床结论**：基于医学标准的诊断建议
- **干预建议**：个性化的家庭干预方案
- **历史对比**：评估结果的纵向追踪

### 技术亮点

- ✅ **纯本地算分**：所有评分逻辑本地执行，零外部依赖
- ✅ **MCP 协议支持**：标准化接口，易于集成到其他系统
- ✅ **会话持久化**：断点续诊，用户体验友好
- ✅ **性能优化**：LRU缓存、预定义响应、数据库索引
- ✅ **测试覆盖**：功能测试、性能测试、端到端测试

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端层 (Next.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 分诊界面 │  │ 量表答题 │  │ 结果展示 │  │ 用户中心 │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     API 层 (REST)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 分诊API  │  │ 量表API  │  │ 语音API  │  │ 用户API  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   服务层 (Business)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 分诊流程 │  │ 量表引擎 │  │ AI服务   │  │ 语音服务 │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   数据层 (PostgreSQL)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 用户数据 │  │ 评估记录 │  │ 分诊会话 │  │ API密钥  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js | 15.0 |
| **开发语言** | TypeScript | 5.0 |
| **UI框架** | Tailwind CSS | 3.4 |
| **数据库** | PostgreSQL (Supabase) | 15.0 |
| **ORM** | Prisma | 5.0 |
| **AI集成** | 腾讯混元 / DeepSeek | - |
| **语音识别** | 腾讯云语音识别 | - |
| **协议** | MCP (Model Context Protocol) | 2024-11 |

---

## 📊 已支持量表

### 自闭症谱系障碍

| 量表ID | 名称 | 题目数 | 用途 | 完成度 |
|--------|------|--------|------|--------|
| **ABC** | 孤独症行为评定量表 | 57题 | 自闭症广筛 | ✅ 100% |
| **CARS** | 卡氏儿童孤独症评定量表 | 15题 | 自闭症诊断 | ✅ 100% |
| **SRS** | 社交反应量表 | 65题 | 社交能力评估 | ✅ 100% |

### 注意缺陷多动障碍

| 量表ID | 名称 | 题目数 | 用途 | 完成度 |
|--------|------|--------|------|--------|
| **SNAP-IV** | 注意力量表 | 26题 | ADHD评估 | ✅ 100% |

### 评分示例

```typescript
// ABC 量表评分示例
const answers = [4, 2, 4, 2, 4, ...]; // 用户每题得分
const result = ABC_Scale.calculateScore(answers);

// 输出
{
  totalScore: 142,
  conclusion: "高度疑似",
  details: {
    level: "高度疑似",
    description: "孤独症相关行为特征非常明显，强烈建议立即就医..."
  }
}
```

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- PostgreSQL >= 15.0 (推荐使用 Supabase)
- npm 或 pnpm

### 1. 克隆项目

```bash
git clone https://github.com/Handsome5201314/ai-scale-system.git
cd ai-scale-system
```

### 2. 安装依赖

```bash
npm install
# 或使用 pnpm
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置 (Supabase)
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

# AI 服务配置
DEEPSEEK_API_KEY="your-deepseek-api-key"
TENCENT_SECRET_ID="your-tencent-secret-id"
TENCENT_SECRET_KEY="your-tencent-secret-key"

# 应用配置
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 同步数据库结构
npx prisma db push

# (可选) 查看数据库
npx prisma studio
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 开始使用！

---

## 📦 安装部署

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
```

### 生产环境

#### 方式1: Vercel 部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Handsome5201314/ai-scale-system)

1. 点击上方按钮
2. 配置环境变量
3. 自动部署完成

#### 方式2: Docker 部署

```bash
# 构建镜像
docker build -t ai-scale-system .

# 运行容器
docker run -p 3000:3000 \
  -e DATABASE_URL="your-database-url" \
  -e DEEPSEEK_API_KEY="your-api-key" \
  ai-scale-system
```

#### 方式3: 传统部署

```bash
# 构建
npm run build

# 启动
npm start

# 使用 PM2 管理进程
pm2 start npm --name "ai-scale-system" -- start
```

详细部署文档请查看 [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

---

## 📚 使用指南

### 1. 管理员设置

首次使用需要配置管理员账户和API密钥：

```bash
# 访问管理后台
http://localhost:3000/admin

# 默认账号
用户名: admin
密码: admin123
```

在管理后台配置：
- AI 服务密钥（DeepSeek、腾讯混元等）
- 语音服务密钥
- 系统参数

### 2. 用户评估流程

1. **进入分诊**：用户打开系统，开始语音对话
2. **症状描述**：家长描述孩子的行为特征
3. **量表推荐**：AI 推荐合适的评估量表
4. **量表答题**：通过语音或文本完成量表题目
5. **查看报告**：系统生成评估报告和干预建议

### 3. 开发者集成

通过 MCP 协议集成到其他系统：

```javascript
// Python 示例
from mcp import Client

client = Client("http://localhost:3000/api/mcp/scale")

# 获取量表列表
scales = await client.call_tool("list_scales", {})

# 获取量表题目
questions = await client.call_tool("get_scale_questions", {
    "scaleId": "ABC"
})

# 提交评估
result = await client.call_tool("submit_assessment", {
    "deviceId": "user-123",
    "scaleId": "ABC",
    "answers": [0, 1, 2, 1, 0, ...]
})
```

详细API文档请查看 [docs/AGENT_SCALE_INTEGRATION_GUIDE.md](docs/AGENT_SCALE_INTEGRATION_GUIDE.md)

---

## 🔌 API文档

### MCP 接口

提供三个核心工具：

#### 1. `list_scales` - 获取量表列表

```json
{
  "name": "list_scales",
  "arguments": {}
}
```

#### 2. `get_scale_questions` - 获取量表题目

```json
{
  "name": "get_scale_questions",
  "arguments": {
    "scaleId": "ABC",
    "offset": 0,
    "limit": 10
  }
}
```

#### 3. `submit_assessment` - 提交评估

```json
{
  "name": "submit_assessment",
  "arguments": {
    "deviceId": "user-123",
    "scaleId": "ABC",
    "answers": [0, 1, 2, 1, 0, ...]
  }
}
```

### REST API

详细的 REST API 文档请查看 [API Reference](docs/API_REFERENCE.md)

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 贡献方式

1. **报告 Bug** - 提交 [Bug 报告](https://github.com/Handsome5201314/ai-scale-system/issues/new?template=bug_report.md)
2. **建议功能** - 提交 [功能请求](https://github.com/Handsome5201314/ai-scale-system/issues/new?template=feature_request.md)
3. **添加量表** - 提交 [量表请求](https://github.com/Handsome5201314/ai-scale-system/issues/new?template=scale_request.md)
4. **改进文档** - 完善 README 或其他文档
5. **提交代码** - 修复 Bug 或实现新功能

### 开发流程

```bash
# 1. Fork 项目
git clone https://github.com/your-username/ai-scale-system.git

# 2. 创建特性分支
git checkout -b feature/amazing-feature

# 3. 提交变更
git commit -m 'feat: 添加某某功能'

# 4. 推送到分支
git push origin feature/amazing-feature

# 5. 创建 Pull Request
```

### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 配置
- 添加必要的注释和文档
- 编写单元测试

详细贡献指南请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

### 技术支持

- [Next.js](https://nextjs.org/) - React 框架
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [Supabase](https://supabase.com/) - PostgreSQL 托管服务
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [MCP](https://modelcontextprotocol.io/) - Model Context Protocol

### 医学支持

感谢所有为儿童心理健康事业做出贡献的医学专家和研究机构。

---

## 📞 联系方式

- **GitHub Issues**: [提交问题](https://github.com/Handsome5201314/ai-scale-system/issues)
- **项目主页**: [https://github.com/Handsome5201314/ai-scale-system](https://github.com/Handsome5201314/ai-scale-system)

---

## ⚠️ 免责声明

本系统**仅供筛查参考**，不能替代专业医疗诊断。评估结果仅供参考，如有疑虑，请及时就医咨询专业医生。

---

## 🗺️ 项目路线图

### v1.0.0 (当前版本)

- ✅ 核心 4D 数据结构
- ✅ 4 个医学量表（ABC, CARS, SRS, SNAP-IV）
- ✅ 智能分诊系统
- ✅ 语音交互功能
- ✅ MCP 协议支持
- ✅ 评估报告生成

### v1.1.0 (计划中)

- [ ] 更多量表（M-CHAT, ADOS等）
- [ ] 多语言支持
- [ ] 移动端适配
- [ ] 数据导出功能

### v2.0.0 (未来规划)

- [ ] AI 辅助诊断
- [ ] 家长培训课程
- [ ] 医生协作平台
- [ ] 区域数据统计

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给一个 Star ⭐**

Made with ❤️ by [Handsome5201314](https://github.com/Handsome5201314)

</div>
