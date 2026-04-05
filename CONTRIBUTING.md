# 🤝 贡献指南

感谢您考虑为 AI 量表系统做出贡献！

## 📋 目录

- [行为准则](#行为准则)
- [我可以如何贡献](#我可以如何贡献)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [添加新量表](#添加新量表)

---

## 📜 行为准则

本项目采用贡献者公约作为行为准则。参与此项目即表示您同意遵守其条款。请阅读 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 了解详情。

---

## 🎯 我可以如何贡献

### 报告 Bug

在提交 Bug 报告之前，请先：
1. 检查 [Issues](https://github.com/Handsome5201314/ai-scale-system/issues) 中是否已有相同问题
2. 确认您使用的是最新版本
3. 收集以下信息：
   - 操作系统和版本
   - Node.js 版本
   - 浏览器版本（如适用）
   - 复现步骤
   - 期望行为
   - 实际行为

提交 Bug 报告时，请使用 [Bug 报告模板](https://github.com/Handsome5201314/ai-scale-system/issues/new?template=bug_report.md)。

### 建议新功能

我们欢迎任何改进建议！请：
1. 清晰描述功能及其价值
2. 提供使用场景示例
3. 如有可能，提供实现思路

提交功能请求时，请使用 [功能请求模板](https://github.com/Handsome5201314/ai-scale-system/issues/new?template=feature_request.md)。

### 添加新量表

如果您想添加新的医学量表，请：
1. 确认量表没有版权限制或已获得授权
2. 准备完整的量表数据（题目、选项、评分标准）
3. 遵循 4D 临床数据结构

详细步骤请查看 [添加新量表指南](docs/ADD_NEW_SCALE_GUIDE.md)。

提交量表请求时，请使用 [量表请求模板](https://github.com/Handsome5201314/ai-scale-system/issues/new?template=scale_request.md)。

### 改进文档

文档改进包括：
- 修正拼写或语法错误
- 添加缺失的文档
- 改进现有文档的清晰度
- 翻译文档到其他语言

### 提交代码

详见下方的 [开发流程](#开发流程)。

---

## 🔧 开发流程

### 1. Fork 并克隆项目

```bash
# Fork 项目后，克隆您的 fork
git clone https://github.com/your-username/ai-scale-system.git
cd ai-scale-system

# 添加上游仓库
git remote add upstream https://github.com/Handsome5201314/ai-scale-system.git
```

### 2. 创建分支

```bash
# 更新主分支
git checkout main
git pull upstream main

# 创建特性分支
git checkout -b feature/amazing-feature
# 或修复分支
git checkout -b fix/bug-description
```

分支命名规范：
- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关
- `chore/` - 其他杂项

### 3. 安装依赖

```bash
npm install
```

### 4. 配置环境

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写必要配置
```

### 5. 启动开发服务器

```bash
npm run dev
```

### 6. 进行开发

- 编写代码
- 添加测试
- 更新文档

### 7. 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- path/to/test

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

### 8. 提交变更

```bash
git add .
git commit -m "feat: 添加某某功能"
```

提交信息请遵循 [提交规范](#提交规范)。

### 9. 推送到 Fork

```bash
git push origin feature/amazing-feature
```

### 10. 创建 Pull Request

前往 GitHub 创建 Pull Request，请使用 [PR 模板](https://github.com/Handsome5201314/ai-scale-system/compare)。

---

## 📏 代码规范

### TypeScript 规范

```typescript
// ✅ 好的做法
interface ScaleQuestion {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  options: ScaleOption[];
}

// ❌ 避免
var question = {
  id: 1,
  text: '...',
  // 缺少类型定义
}
```

### 命名规范

- **文件名**：小写+连字符，如 `scale-engine.ts`
- **组件名**：大驼峰，如 `ScaleCard.tsx`
- **函数名**：小驼峰，如 `calculateScore()`
- **常量**：大写+下划线，如 `MAX_RETRY_COUNT`
- **接口/类型**：大驼峰，如 `ScaleDefinition`

### 注释规范

```typescript
/**
 * 计算量表总分并返回临床结论
 * @param answers 用户答案数组
 * @returns 评分结果对象
 */
function calculateScore(answers: number[]): ScaleScoreResult {
  // 实现逻辑
}
```

### 代码格式化

使用 Prettier 和 ESLint：

```bash
# 格式化代码
npm run format

# 检查代码
npm run lint

# 自动修复
npm run lint:fix
```

---

## 📝 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型 (type)

- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档更新
- `style` - 代码格式（不影响功能）
- `refactor` - 重构
- `test` - 测试相关
- `chore` - 构建/工具相关
- `perf` - 性能优化

### 范围 (scope) - 可选

- `scale` - 量表相关
- `api` - API 相关
- `ui` - 界面相关
- `db` - 数据库相关

### 示例

```bash
# 新功能
feat(scale): 添加 SNAP-IV 量表

# Bug 修复
fix(api): 修复语音识别接口超时问题

# 文档更新
docs(readme): 更新安装步骤

# 重构
refactor(scale): 优化评分算法性能

# 破坏性变更
feat(api)!: 重构 API 接口格式

BREAKING CHANGE: API 返回格式从对象改为数组
```

---

## 🔄 Pull Request 流程

### 提交前检查清单

- [ ] 代码遵循项目的编码规范
- [ ] 已进行自我审查
- [ ] 已添加必要的注释
- [ ] 已更新相关文档
- [ ] 没有引入新的警告
- [ ] 已添加测试用例
- [ ] 所有测试通过

### PR 标题

使用与提交信息相同的格式：

```
feat(scale): 添加儿童焦虑量表
```

### PR 描述

请使用项目提供的 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)，包含：

1. **变更类型** - 勾选适用的类型
2. **变更描述** - 清晰描述您的变更
3. **相关 Issue** - 关联相关 Issue
4. **测试说明** - 描述如何测试
5. **截图** - 如适用，添加截图

### 审查流程

1. 提交 PR 后，维护者会进行审查
2. 可能会提出修改建议
3. 根据反馈进行修改
4. 审查通过后会被合并

### 合并要求

- 至少 1 位维护者批准
- 通过所有 CI 检查
- 没有合并冲突

---

## 📊 添加新量表

详细步骤请查看 [添加新量表指南](docs/ADD_NEW_SCALE_GUIDE.md)。

### 快速步骤

1. **创建量表文件**

```bash
# 选择合适的目录
lib/scales/[category]/[scale-id].ts
```

2. **定义 4D 结构**

```typescript
import type { ScaleDefinition, ScaleQuestion } from "../core/types";

const QUESTIONS: ScaleQuestion[] = [
  {
    id: 1,
    text: "学术原版文本",
    clinical_intent: "临床意图",
    colloquial: "大白话表述",
    fallback_examples: ["追问示例1", "追问示例2"],
    options: [
      { label: "从不", score: 0 },
      { label: "偶尔", score: 1 },
    ]
  },
  // ... 更多题目
];
```

3. **实现评分函数**

```typescript
export const NEW_Scale: ScaleDefinition = {
  id: "NEW",
  version: "1.0",
  title: "新量表名称",
  description: "量表描述",
  questions: QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    const totalScore = answers.reduce((sum, s) => sum + s, 0);
    // 临床判定逻辑
    return { totalScore, conclusion, details };
  }
};
```

4. **注册到全局**

编辑 `lib/schemas/core/registry.ts`：

```typescript
import { NEW_Scale } from "../category/new-scale";

export const AllScales: ScaleDefinition[] = [
  // ... 现有量表
  NEW_Scale,
];
```

5. **更新分诊提示词**

编辑 `lib/services/triageFlow.ts`，添加新量表信息。

6. **测试验证**

```bash
# 运行测试
npm test

# 端到端测试
npm run test:e2e
```

---

## 🧪 测试规范

### 单元测试

```typescript
describe('ScaleEngine', () => {
  it('should calculate correct score', () => {
    const answers = [1, 2, 3, 2, 1];
    const result = calculateScore(answers);
    expect(result.totalScore).toBe(9);
  });
});
```

### 测试覆盖率

- 新功能必须包含测试
- 目标覆盖率：80% 以上

### 运行测试

```bash
# 所有测试
npm test

# 监听模式
npm test -- --watch

# 覆盖率报告
npm test -- --coverage
```

---

## 📚 文档规范

### Markdown 格式

- 使用标准 Markdown 语法
- 添加目录导航
- 代码块指定语言
- 使用相对链接

### 文档结构

```
# 标题

## 简介

简要描述

## 目录

- [章节1](#章节1)
- [章节2](#章节2)

## 章节1

内容...

## 章节2

内容...
```

---

## 🌍 翻译贡献

欢迎帮助翻译项目文档到其他语言：

1. 创建 `docs/[lang]/` 目录
2. 翻译对应文档
3. 提交 PR

当前支持的语言：
- 🇨🇳 简体中文（主要）
- 🇺🇸 English（计划中）

---

## 📞 获取帮助

如果您在贡献过程中遇到问题：

1. 查看 [文档](docs/)
2. 搜索 [Issues](https://github.com/Handsome5201314/ai-scale-system/issues)
3. 提交新 Issue

---

## 🎉 致谢

感谢所有贡献者的付出！您的每一份贡献都让这个项目变得更好。

查看 [贡献者列表](https://github.com/Handsome5201314/ai-scale-system/graphs/contributors)

---

<div align="center">

**Happy Coding! 🚀**

</div>
