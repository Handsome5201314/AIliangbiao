# 量表内容维护说明

本目录用于维护从量表逻辑代码中抽离出来的内容数据。

当前已接入的半配置化量表：

- `srs.content.json`
- `abc.content.json`
- `snap-iv.content.json`
- `cars.content.json`

对应的模板文件：

- `srs.content.template.json`
- `abc.content.template.json`
- `snap-iv.content.template.json`
- `cars.content.template.json`

## 设计原则

- `*.content.json` 是对应量表的内容唯一来源。
- `lib/schemas/**/*.ts` 只保留元信息、分值注入、维度/阈值/结论逻辑。
- 内容维护优先改 JSON，不要回到 TS 里改题干、解释、追问。
- `score` 永远不写入 JSON，由 TS 在运行时自动注入。

## 每个文件分别负责什么

### `srs.content.json`

负责：

- 题干
- 临床意图
- 口语化提问
- 追问示例
- 四档选项标签
- 四档解释文案
- 选项级 `aliases`
- 人工维护备注 `notes`

`lib/schemas/autism/srs.ts` 负责：

- 量表元信息
- 反向计分题映射
- 选项分数注入
- 结果阈值与结论

### `abc.content.json`

负责：

- 题干
- 临床意图
- 口语化提问
- 追问示例
- 两档选项标签
- 两档解释文案
- 选项级 `aliases`
- 人工维护备注 `notes`

`lib/schemas/autism/abc.ts` 负责：

- 量表元信息
- 每题“是”选项的权重映射
- 选项分数注入
- 结果阈值与结论

### `snap-iv.content.json`

负责：

- 题干
- 临床意图
- 口语化提问
- 追问示例
- 四档选项标签
- 四档解释文案
- 选项级 `aliases`
- 人工维护备注 `notes`

`lib/schemas/adhd/snap-iv.ts` 负责：

- 量表元信息
- 固定四档分值 `0/1/2/3`
- 三个维度分切片逻辑
- 结果阈值与结论

### `cars.content.json`

负责：

- 题干
- 临床意图
- 口语化提问
- 追问示例
- 四档选项标签
- 四档解释文案
- 选项级 `aliases`
- 人工维护备注 `notes`

`lib/schemas/autism/cars.ts` 负责：

- 量表元信息
- 固定四档分值 `1/2/3/4`
- 结果阈值与结论

## JSON 结构

顶层字段：

- `version`
- `questions`

每道题必填字段：

- `id`
- `text`
- `clinical_intent`
- `colloquial`
- `fallback_examples`
- `options`

每道题可选字段：

- `notes`

每个 `options` 项支持：

- `label`
- `description`
- `aliases`

## 重要约束

- 禁止在 JSON 里写 `score`。
- `fallback_examples` 必须是数组，可以为空数组。
- `aliases` 如果存在，必须是数组。
- `notes` 如果存在，必须是字符串。
- `text / clinical_intent / colloquial / option.label` 不能为空字符串。
- 题号必须唯一且连续。

各量表选项数量：

- `SRS`: 每题 4 个选项
- `ABC`: 每题 2 个选项
- `SNAP-IV`: 每题 4 个选项
- `CARS`: 每题 4 个选项

## 最小样例

```json
{
  "id": 9,
  "text": "粘着大人，对他们十分依赖。",
  "clinical_intent": "评估过度依恋或分离焦虑",
  "colloquial": "他是不是特别粘着您或者家里的大人，像个小尾巴一样走哪跟哪？",
  "fallback_examples": ["哪怕是一会儿不见都不行？"],
  "notes": "可选：只用于人工维护，不参与渲染和计分。",
  "options": [
    {
      "label": "从不",
      "description": "几乎没出现过下面这些情况，孩子能自己玩或接受大人暂时离开。",
      "aliases": ["几乎没有", "基本不会"]
    },
    {
      "label": "偶尔",
      "description": "每周1-2次，或只在特殊情况下（生病、困了、陌生环境）。"
    },
    {
      "label": "经常",
      "description": "每天都会发生几次，但不是一整天都这样。"
    },
    {
      "label": "总是",
      "description": "几乎每次大人移动、做家务、上厕所、接电话时，孩子都会立刻跟过来或要求抱/陪。"
    }
  ]
}
```

## 常见错误

- 把 `score` 手写进 JSON。
- 选项数量写错。
- 把整段长解释塞进 `label`，导致界面和语音识别变差。
- 把 `fallback_examples` 写成字符串，而不是数组。
- 把 `aliases` 写成字符串，而不是数组。
- 调整题目顺序后，没有同步检查 TS 里的分值映射或反向计分映射。
- 在 `ABC` 里把“是”选项权重误写进 JSON。
- 在 `SNAP-IV` 里把 `0/1/2/3` 分值误写进 JSON。
- 在 `CARS` 里把 `1/2/3/4` 分值误写进 JSON。

## 常见维护动作

### 我要改一题怎么改

1. 打开对应的 `*.content.json`
2. 找到对应 `id`
3. 修改需要变更的字段
4. 保存后运行：

```bash
npm run content:check
npm run build
npm run skill:build
```

5. 本地打开对应量表页面核对显示效果

### 我要批量统一某套量表的选项解释怎么改

1. 在对应 `*.content.json` 中全局搜索某个选项标签
2. 批量修改对应的 `description`
3. 如果只是参考标准结构，可以先看对应的 `*.content.template.json`

### 我要给某题补 aliases 怎么改

在某个选项下补：

```json
{
  "label": "偶尔",
  "description": "每周1-2次，或只在特殊情况下出现。",
  "aliases": ["有时", "偶发", "偶然会"]
}
```

建议：

- `aliases` 只放必要近义词
- 不要把整段解释原样复制到 `aliases`

## 推荐工作流

1. 修改对应的 `*.content.json`
2. 运行：

```bash
npm run content:check
npm run build
npm run skill:build
```

3. 本地打开量表页面核对：
   - 题干
   - 口语化提问
   - fallback
   - 选项标签
   - 选项解释
4. 确认无误后再决定是否发版

## 如果文件太长怎么办

当前运行时仍只读取正式内容文件，比如：

- `srs.content.json`
- `abc.content.json`
- `snap-iv.content.json`
- `cars.content.json`

如果后续人工维护时觉得太长，推荐做法是：

- 保持运行时仍只读一个正式 JSON
- 额外准备一份人工校对参考稿，按题号区间拆分阅读

这样可以改善审阅体验，但不会增加运行时复杂度。
