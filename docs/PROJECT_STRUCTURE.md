# 项目结构说明

## 📁 目录结构

```
ai-scale-system/
├── .github/                    # GitHub 配置文件
│   ├── ISSUE_TEMPLATE/         # Issue 模板
│   │   ├── bug_report.md      # Bug 报告模板
│   │   ├── feature_request.md # 功能请求模板
│   │   └── scale_request.md   # 量表请求模板
│   ├── workflows/             # GitHub Actions 工作流
│   └── PULL_REQUEST_TEMPLATE.md # PR 模板
│
├── app/                        # Next.js App Router
│   ├── admin/                 # 管理后台页面
│   │   └── apikeys/          # API 密钥管理
│   ├── api/                   # API 路由
│   │   ├── admin/            # 管理员 API
│   │   ├── assessment/       # 评估相关 API
│   │   ├── mcp/              # MCP 服务端点
│   │   │   ├── scale/        # 量表服务
│   │   │   ├── memory/       # 记忆服务
│   │   │   └── growth/       # 成长服务
│   │   ├── speech/           # 语音识别 API
│   │   ├── triage/           # 分诊 API
│   │   └── user/             # 用户 API
│   ├── globals.css           # 全局样式
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # 首页
│
├── components/                 # React 组件
│   ├── ui/                    # 基础 UI 组件
│   ├── ScaleCard.tsx         # 量表卡片
│   ├── TriageVoiceRecorder.tsx # 语音分诊组件
│   └── ...                    # 其他组件
│
├── contexts/                   # React Context
│   └── ConversationHistoryContext.tsx # 对话历史上下文
│
├── lib/                        # 核心库
│   ├── ai/                    # AI 服务
│   │   └── predefinedResponses.ts # 预定义响应
│   ├── auth/                  # 认证相关
│   ├── cache/                 # 缓存模块
│   │   ├── speechCache.ts    # 语音缓存
│   │   ├── promptCache.ts    # 提示词缓存
│   │   └── queryCache.ts     # 查询缓存
│   ├── db/                    # 数据库
│   │   └── prisma.ts         # Prisma 客户端
│   ├── mcp/                   # MCP 相关
│   │   ├── server-handlers.ts # MCP 服务处理
│   │   └── skills/           # MCP Skills
│   ├── schemas/               # 量表定义
│   │   ├── core/             # 核心类型
│   │   │   ├── types.ts      # 4D 结构定义
│   │   │   └── registry.ts   # 量表注册表
│   │   ├── autism/           # 自闭症量表
│   │   │   ├── abc.ts        # ABC 量表
│   │   │   ├── cars.ts       # CARS 量表
│   │   │   └── srs.ts        # SRS 量表
│   │   └── adhd/             # ADHD 量表
│   │       └── snap-iv.ts    # SNAP-IV 量表
│   ├── services/              # 业务服务
│   │   ├── triageFlow.ts     # 分诊流程
│   │   └── userContext.ts    # 用户上下文
│   └── utils/                 # 工具函数
│
├── prisma/                     # Prisma ORM
│   └── schema.prisma          # 数据库模型定义
│
├── scripts/                    # 工具脚本
│   ├── add-indexes.sql        # 数据库索引脚本
│   └── ...                    # 其他脚本
│
├── tests/                      # 测试文件
│   ├── test-triage-flow.mjs   # 分诊测试
│   ├── test-questionnaire.mjs # 问卷测试
│   └── ...                    # 其他测试
│
├── types/                      # TypeScript 类型定义
│   └── index.ts               # 全局类型
│
├── docs/                       # 项目文档
│   ├── ADD_NEW_SCALE_GUIDE.md        # 添加新量表指南
│   ├── DEPLOYMENT_GUIDE.md           # 部署指南
│   ├── AGENT_SCALE_INTEGRATION_GUIDE.md # API 文档
│   └── SUPABASE_SETUP_GUIDE.md       # 数据库配置
│
├── .env.example               # 环境变量示例
├── .gitignore                 # Git 忽略配置
├── CHANGELOG.md               # 更新日志
├── CODE_OF_CONDUCT.md         # 行为准则
├── CONTRIBUTING.md            # 贡献指南
├── LICENSE                    # MIT 许可证
├── README.md                  # 项目说明
├── next.config.js             # Next.js 配置
├── package.json               # 项目依赖
├── postcss.config.mjs         # PostCSS 配置
├── tailwind.config.ts         # Tailwind 配置
└── tsconfig.json              # TypeScript 配置
```

## 🔑 核心模块说明

### 1. 量表引擎 (`lib/schemas/`)

- **core/types.ts**: 定义 4D 临床数据结构
- **core/registry.ts**: 管理所有已注册的量表
- **autism/**: 自闭症相关量表
- **adhd/**: ADHD 相关量表

### 2. MCP 服务 (`lib/mcp/`)

- **server-handlers.ts**: MCP 协议处理
- **skills/**: 可扩展的技能模块

### 3. API 路由 (`app/api/`)

- **mcp/scale/**: 量表服务 API
- **triage/**: 分诊服务 API
- **speech/**: 语音识别 API

### 4. 缓存系统 (`lib/cache/`)

- **speechCache.ts**: 语音识别结果缓存
- **promptCache.ts**: AI 提示词缓存
- **queryCache.ts**: 数据库查询缓存

### 5. 前端组件 (`components/`)

- **TriageVoiceRecorder.tsx**: 语音分诊主组件
- **ScaleCard.tsx**: 量表展示卡片

## 📊 数据库模型

### 核心表

- **User**: 用户信息
- **AssessmentHistory**: 评估历史
- **TriageSession**: 分诊会话
- **ApiKey**: API 密钥管理

详细定义见 `prisma/schema.prisma`

## 🔄 工作流程

### 评估流程

```
用户进入 → 语音分诊 → 症状收集 → 量表推荐 
    ↓
用户同意 → 开始量表 → 语音/文本答题 → 提交答案
    ↓
本地算分 → 生成报告 → 存储记录 → 展示结果
```

### 开发流程

```
克隆项目 → 安装依赖 → 配置环境 → 启动开发服务器
    ↓
修改代码 → 运行测试 → 提交 PR → 代码审查
    ↓
合并代码 → 自动部署 → 发布版本
```

## 🛠️ 配置文件

### Next.js (`next.config.js`)

- API 路由配置
- 环境变量设置
- 构建优化

### TypeScript (`tsconfig.json`)

- 严格模式
- 路径别名
- 类型检查

### Tailwind (`tailwind.config.ts`)

- 主题配置
- 插件设置
- 响应式断点

### Prisma (`prisma/schema.prisma`)

- 数据模型定义
- 关系映射
- 索引配置

## 📝 文档结构

- **README.md**: 项目概览和快速开始
- **CONTRIBUTING.md**: 贡献指南
- **CHANGELOG.md**: 版本更新记录
- **docs/**: 详细文档目录

## 🧪 测试结构

- **tests/**: 所有测试文件
- 单元测试
- 集成测试
- 端到端测试

## 🚀 部署结构

支持多种部署方式：
- Vercel (推荐)
- Docker
- 传统服务器

详见 `docs/DEPLOYMENT_GUIDE.md`
