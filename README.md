<div align="center">

# AI 量表系统

全人群心理与健康评测平台  
支持儿童、成人、老年人的多量表评估、家庭成员档案、语音分诊与配置化量表扩展。

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## 项目概览

这个项目已经从早期的“儿童发育量表站点”升级为一个更通用的评测平台，当前具备以下能力：

- 多量表大厅：支持儿童发育、成人心理、人格测试、职业测评等分类
- 家庭成员档案：同一账号下可逐步支持本人、孩子、父母、配偶等多个成员
- 语音分诊：支持聊天式症状描述、推荐量表和进入正式测评
- 确定性评分：量表结果由服务端规则引擎计算，不依赖模型直接算分
- 配置化量表：支持通过 `data/scales/*.json` 热插拔新增量表
- 云端部署：已支持 `ailiangbiao.agentpit.io` 生产部署与 HTTPS 自动续期

当前技术栈：

- Next.js 16
- React 19
- TypeScript 6
- Prisma 5
- PostgreSQL
- Tailwind CSS
- MCP SDK

## 当前功能

### 1. 量表系统

项目现在同时支持两种量表接入方式：

- 内置量表：写在 `lib/schemas/**`，适合复杂评分逻辑
- 配置化量表：写在 `data/scales/*.json`，适合快速扩展

当前已接入量表：

| 分类 | 量表 | ID | 形态 |
|---|---|---|---|
| 儿童发育 | 孤独症行为评定量表 | `ABC` | 内置 |
| 儿童发育 | 卡氏儿童孤独症评定量表 | `CARS` | 内置 |
| 儿童发育 | 社交反应量表 | `SRS` | 内置 |
| 儿童发育 | 注意缺陷多动障碍筛查量表 | `SNAP-IV` | 内置 |
| 人格测试 | MBTI 职业性格测试 | `MBTI` | 内置 |
| 职业测评 | 霍兰德职业倾向测验量表 | `HOLLAND` | 内置 |
| 成人心理 | 患者健康问卷抑郁量表 | `PHQ-9` | 配置化 |
| 成人心理 | 广泛性焦虑量表 | `GAD-7` | 配置化 |

### 2. 家庭成员档案

当前数据库与前端上下文已经开始支持家庭成员模型：

- 用户角色：`GUEST` / `REGISTERED` / `VIP`
- 成员关系：`SELF` / `CHILD` / `PARENT` / `SPOUSE` / `SIBLING` / `OTHER`
- 语言偏好：`zh` / `en`

实现说明：

- Prisma 层现在使用 `MemberProfile`
- 为兼容旧数据，当前仍通过 `@@map("ChildProfile")` 映射到历史表名
- 前端上下文已支持多成员切换和新增成员

### 3. 额度模型

当前额度逻辑：

- 游客：每天 5 次免费评测
- 注册用户：每天 10 次免费评测
- VIP：预留高额度通道

相关逻辑在：

- `lib/auth/quotaManager.ts`
- `app/api/quota/check/route.ts`
- `app/api/account/upgrade/route.ts`

### 4. 分诊与评测链路

当前平台评测链路：

1. 进入首页量表大厅
2. 可通过搜索框和分类 Tabs 找量表
3. 也可通过语音分诊推荐量表
4. 问卷页支持逐题答题与聊天记录分析
5. 服务端通过 `/api/scales/evaluate` 执行确定性评分
6. 评估结果通过 `/api/assessment/save` 入库
7. 结果页支持导出、AI 建议、答题明细查看

### 5. 多语种基础

项目已完成多语种底层结构的第一阶段：

- `ScaleDefinition.title` / `description` 支持 `zh/en`
- `ScaleQuestion.text` / `colloquial` / `fallback_examples` 支持 `zh/en`
- 首页有语言切换 UI 占位
- 问卷题干与卡片文案已能按语言状态解析

当前仍是前端状态级切换，尚未接入完整 `next-intl` 路由体系。

## 目录结构

```text
app/
  api/                      # REST / MCP / 评测接口
  admin/                    # 后台页面
  page.tsx                  # 量表大厅首页

components/
  Questionnaire.tsx         # 问卷页
  AssessmentResult.tsx      # 结果页
  TriageVoiceRecorder.tsx   # 语音分诊
  AccountOnboardingModal.tsx

contexts/
  ProfileContext.tsx        # 当前成员、多成员、账号升级上下文

lib/
  auth/                     # 额度逻辑
  scales/                   # 量表目录装载与评分
  schemas/                  # 内置量表
  services/                 # 分诊、画像、语音等服务
  mcp/                      # MCP skill 与 server handler

data/
  scales/                   # 配置化量表 JSON

prisma/
  schema.prisma            # 数据模型

scripts/
  redeploy-agent1002.ps1   # Windows 一键重部署
  remote-redeploy.sh       # 远端重部署脚本

docs/
  scale-manifest.md
  redeploy-agent1002.md
```

## 本地开发

### 环境要求

- Node.js 20+
- npm
- PostgreSQL

### 安装依赖

```bash
npm install
```

### 环境变量

复制并配置 `.env`：

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000"
SESSION_SECRET="your-local-secret"

ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123456"
```

重要提醒：

- 本地开发**不建议**直接连接生产数据库
- 如果你改了 `prisma/schema.prisma`，记得执行：

```bash
npx prisma generate
npx prisma db push --accept-data-loss
```

### 启动开发环境

```bash
npm run dev
```

访问：

- 首页：`http://localhost:3000`
- 后台：`http://localhost:3000/admin/login`

### 构建检查

```bash
npm run build
```

## 部署

### 当前生产环境

项目当前生产域名：

- `https://ailiangbiao.agentpit.io`

### 重复部署

如果服务器已经信任 SSH key，可用：

```powershell
pwsh -File .\scripts\redeploy-agent1002.ps1 -KeyPath C:\path\to\your\id_ed25519
```

更多说明见：

- [docs/redeploy-agent1002.md](docs/redeploy-agent1002.md)

### 配置化量表扩展

新增 JSON 量表请参考：

- [docs/scale-manifest.md](docs/scale-manifest.md)

## 关键接口

### 量表

- `GET /api/scales`
- `GET /api/scales?id=ABC`
- `POST /api/scales/evaluate`
- `POST /api/scales/analyze-conversation`

### 账号与画像

- `GET /api/profile/sync`
- `POST /api/profile/sync`
- `POST /api/account/upgrade`
- `GET /api/quota/check`

### 评估

- `POST /api/assessment/save`
- `POST /api/assessment/generate-advice`

### 分诊与语音

- `GET /api/triage/session`
- `POST /api/triage/session`
- `POST /api/speech/transcribe`

### MCP

- `POST /api/mcp`
- `POST /api/mcp/scale`
- `POST /api/mcp/memory`
- `POST /api/mcp/growth`

## 当前设计取舍

这些点是项目目前的现实状态：

- 家庭成员模型已经落地，但“历史记录页 / 趋势页”仍是下一阶段
- 首页已经有显式注册/新增成员入口，但完整手机号/邮箱登录体系仍在过渡中
- 多语种数据结构已铺好，但完整国际化路由体系尚未接入
- `MemberProfile` 目前仍映射到旧表 `ChildProfile`，这是兼容迁移策略，不是最终状态
- 量表平台已从儿童评估扩展到成人心理、人格和职业测评，但部分分诊文案仍有儿童时代遗留语气

## 未来方向

下一阶段更适合继续做：

- 历史记录与趋势图页面
- 正式注册/登录体系
- 分诊前“选择家庭成员”步骤
- 完整 i18n 路由
- 更多心理健康与认知健康量表
- 将更多内置量表迁移为配置化量表

## 许可证

本项目采用 [MIT License](LICENSE)。

## 免责声明

本系统仅用于筛查、教育、职业探索和自我了解参考，不能替代医生、心理咨询师或职业规划师的正式结论。涉及临床风险、严重心理困扰或自伤想法时，请及时寻求专业支持。
