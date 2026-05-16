# 配置化量表接入说明

## 目标

本次改造把量表体系拆成了两层：

- `内置量表`：继续保留在 `lib/schemas/**` 中，适合已有复杂评分逻辑。
- `配置化量表`：新增一个 `data/scales/*.json` 文件即可自动出现在首页、MCP 和评分接口中。

## 新增量表

把量表 JSON 放到：

```text
data/scales/
```

当前仓库已经提供了两个示例：

- `data/scales/phq-9.json`
- `data/scales/gad-7.json`

## Manifest 结构

最小结构如下：

```json
{
  "id": "PHQ-9",
  "version": "1.0",
  "title": "患者健康问卷抑郁量表 (PHQ-9)",
  "description": "用于快速筛查近两周抑郁相关症状强度。",
  "source": "manifest",
  "tags": ["心理", "抑郁"],
  "estimatedMinutes": 4,
  "questions": [
    {
      "id": 1,
      "text": "做事时提不起劲或没有兴趣。",
      "clinical_intent": "评估兴趣减退与快感缺失。",
      "colloquial": "最近两周，你会不会觉得很多事情都提不起兴趣？",
      "fallback_examples": ["比如平常愿意做的事，现在也不太想碰。"],
      "options": [
        { "label": "完全没有", "score": 0 },
        { "label": "几天", "score": 1 },
        { "label": "一半以上天数", "score": 2 },
        { "label": "几乎每天", "score": 3 }
      ]
    }
  ],
  "scoring": {
    "method": "sum",
    "thresholds": [
      {
        "min": 0,
        "max": 4,
        "conclusion": "最小或无抑郁症状",
        "description": "总分处于最小症状范围。"
      }
    ]
  }
}
```

## 运行时行为

- 首页通过 `/api/scales` 动态加载量表，不再依赖手写注册表。
- 问卷完成后通过 `/api/scales/evaluate` 在服务端做确定性评分。
- 评估结果仍通过 `/api/assessment/save` 入库，保留历史记录和版本号。
- MCP 量表工具也已经切到同一套目录和评分引擎。

## 聊天记录自动生成量表

问卷页新增了“分析聊天记录”入口，流程如下：

1. 前端把最近聊天记录提交到 `/api/scales/analyze-conversation`
2. 后端先跑规则兜底提取
3. 如果系统配置了可用模型，再叠加 LLM 结构化抽取
4. 最终仍然只把 `answers` 交给确定性评分引擎，不让 LLM 直接算分

## 适合继续扩展的方向

- 给更多量表补充 `analysisHints`，提升无模型场景下的抽取覆盖率
- 把现有内置量表逐步迁移成 manifest
- 增加维度分、反向题和条件显示的 manifest 能力
- 把聊天抽取证据链持久化到数据库，满足审计追踪需求
