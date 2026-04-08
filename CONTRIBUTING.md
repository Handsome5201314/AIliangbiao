# 贡献指南

感谢你为 AI 量表系统做出贡献。

这份文档面向当前仓库的内部协作场景，重点说明如何提交代码、补充量表、更新运维材料，以及避免把本地或生产环境痕迹带进仓库。

## 贡献范围

欢迎提交以下类型的改动：

- 缺陷修复
- 文档完善
- 新量表接入
- 分诊、评测、AgentPit 接入相关改进
- 运维脚本与部署文档优化

## 开发流程

### 1. 获取代码

```bash
git clone <your-repo-url>
cd ai-scale-system
npm install
```

### 2. 配置环境

- 复制 `.env.example` 为 `.env`
- 配置数据库、`SESSION_SECRET`、管理账号与 AgentPit 相关变量
- 不要把真实 `.env`、私钥、证书和生产连接串提交到仓库

### 3. 本地运行

```bash
npm run dev
```

### 4. 提交前检查

```bash
npm run build
npm run lint
```

如果改动涉及 `packages/assessment-skill`，额外执行：

```bash
npm run skill:build
```

## 代码与仓库约定

- 不要提交 `.env`、SSH 私钥、证书、数据库备份、临时日志、构建产物
- 不要把一次性排障输出、临时测试脚本或本地分析文件留在仓库根目录
- 修改部署脚本前，确认不会把当前机器、密码、路径等敏感信息硬编码进文档或 README
- 涉及运行时接口变更时，同步更新相关文档，至少包括 `README.md` 和必要的运维说明

## 添加新量表

当前仓库支持两种量表接入方式：

- 内置量表：放在 `lib/schemas/**`
- 配置化量表：放在 `data/scales/*.json`

如果新增配置化量表，请同时参考：

- [docs/scale-manifest.md](./docs/scale-manifest.md)

提交量表前请确认：

- 量表数据来源明确
- 题目、选项、评分阈值完整
- `zh/en` 文本结构与现有格式一致
- 如需会话分析支持，补齐 `analysisHints`

## 文档与运维材料

涉及部署、环境变量、AgentPit 接入或服务器重部署时，请同步检查：

- [README.md](./README.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [docs/redeploy-agent1002.md](./docs/redeploy-agent1002.md)

如果某份运维文档只适用于单一机器，也请在文档开头明确说明适用范围。

## Pull Request 建议

提交 PR 或合并前，请尽量说明：

- 改动目标
- 影响范围
- 是否涉及数据库、环境变量或部署步骤变化
- 验证方式
- 是否需要同步更新文档

## 行为准则

请保持沟通直接、尊重、可协作。如需正式行为规范，参见 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。
