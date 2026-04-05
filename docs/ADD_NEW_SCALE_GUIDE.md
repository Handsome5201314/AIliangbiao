# 📚 新增量表完整操作指南

## 🎯 概述

本系统采用 **4D 临床数据结构** 来定义量表,支持语音交互和智能分诊。新增量表需要完成以下步骤:

---

## 📋 前置准备

### 1. 确定量表信息

在开始编码前,请准备以下信息:

| 项目 | 说明 | 示例 |
|------|------|------|
| 量表ID | 唯一标识符(英文大写) | `ABC`, `SNAP-IV` |
| 量表名称 | 完整中文名称 | 孤独症行为评定量表 |
| 量表描述 | 简要说明用途 | 用于筛查和评估儿童孤独症的严重程度 |
| 题目数量 | 总题数 | 57题 |
| 预计时长 | 完成时间 | 12分钟 |
| 评分规则 | 分数计算方式和临床判定标准 | 总分≥68为高度疑似 |

### 2. 准备原始量表数据

收集量表的原始学术版本:
- ✅ 题目原文(学术版)
- ✅ 选项列表及分数
- ✅ 评分标准
- ✅ 临床判定阈值

---

## 🚀 步骤1: 创建量表文件

### 1.1 确定量表分类目录

根据量表类型选择目录:

```
lib/schemas/
├── core/           # 核心类型定义
│   ├── types.ts    # 4D结构接口
│   └── registry.ts # 量表注册表
├── autism/         # 自闭症类量表
│   ├── abc.ts
│   ├── cars.ts
│   └── srs.ts
└── adhd/           # ADHD类量表
    └── snap-iv.ts
```

**规则:**
- 自闭症相关 → `lib/schemas/autism/`
- ADHD相关 → `lib/schemas/adhd/`
- 其他类型 → 创建新目录,如 `lib/schemas/anxiety/`

### 1.2 创建新文件

**示例:** 添加"儿童焦虑量表"(Anxiety Scale)

```bash
# 创建文件
lib/schemas/anxiety/anxiety-scale.ts
```

---

## 🛠️ 步骤2: 编写4D结构化数据

### 2.1 导入类型定义

```typescript
import type { ScaleDefinition, ScaleQuestion } from "../core/types";
```

### 2.2 定义选项生成函数(可选)

如果量表的所有题目使用相同的选项,可以创建辅助函数:

```typescript
/**
 * 辅助函数：生成 0-3 分选项
 */
const createOptions = () => [
  { label: "从不", score: 0 },
  { label: "偶尔", score: 1 },
  { label: "经常", score: 2 },
  { label: "总是", score: 3 }
];
```

**或者每题不同权重:**

```typescript
/**
 * 根据权重生成是/否选项
 */
const createOptions = (weight: number) => [
  { label: "否", score: 0 },
  { label: "是", score: weight }
];
```

### 2.3 编写题目列表

**核心:** 每个题目需要填写4个维度:

```typescript
const ANXIETY_QUESTIONS: ScaleQuestion[] = [
  { 
    id: 1,  // 题号,从1开始
    text: '在学习时感到紧张或不安',  // 学术原版文本
    clinical_intent: '评估学习场景下的焦虑表现',  // 核心临床意图
    colloquial: '宝宝学习或者做作业的时候,是不是经常觉得紧张、不安?',  // 破冰大白话
    fallback_examples: [  // 追问策略(当用户回答模糊时)
      '比如一拿起书本就心跳加快、手心出汗?',
      '或者一到考试前就特别紧张?'
    ],
    options: createOptions()  // 选项列表
  },
  { 
    id: 2, 
    text: '害怕去学校', 
    clinical_intent: '评估学校恐惧症表现',
    colloquial: '宝宝是不是不愿意去学校,甚至害怕去学校?',
    fallback_examples: [
      '每天早上是不是都要磨蹭很久不想出门?',
      '提到学校就肚子疼或者头疼?'
    ],
    options: createOptions()
  },
  // ... 继续添加所有题目
];
```

**字段说明:**

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `id` | ✅ | 题目序号(从1开始) | 1, 2, 3... |
| `text` | ✅ | 学术原版文本(引用量表手册) | "害怕去学校" |
| `clinical_intent` | ✅ | 一句话描述本题探测什么 | "评估学校恐惧症表现" |
| `colloquial` | ✅ | 面向普通用户的通俗表述 | "宝宝是不是不愿意去学校?" |
| `fallback_examples` | ✅ | 追问示例(至少1个) | ["每天早上是不是都要磨蹭很久?"] |
| `options` | ✅ | 选项列表(含标签和分数) | [{label: "从不", score: 0}] |

---

## 📊 步骤3: 实现评分逻辑

### 3.1 编写评分函数

```typescript
export const ANXIETY_Scale: ScaleDefinition = {
  id: "ANXIETY",  // 量表唯一ID
  version: "1.0",  // 版本号
  title: "儿童焦虑量表 (Anxiety Scale)",
  description: "用于评估儿童焦虑症状的严重程度,包括学习焦虑、社交焦虑等多个维度。",
  questions: ANXIETY_QUESTIONS,
  
  // 评分函数
  calculateScore: (answers: number[]) => {
    // 计算总分
    const totalScore = answers.reduce((sum, score) => sum + score, 0);
    
    // 临床判定
    let conclusion: string;
    let details = { level: "", description: "" };

    if (totalScore >= 30) {
      conclusion = "重度焦虑";
      details = {
        level: "重度",
        description: "焦虑症状非常明显,严重影响日常生活和学习,强烈建议立即寻求儿童心理科或精神科专业帮助。"
      };
    } else if (totalScore >= 20) {
      conclusion = "中度焦虑";
      details = {
        level: "中度",
        description: "存在明显的焦虑症状,建议尽快咨询专业心理医生进行评估和干预。"
      };
    } else if (totalScore >= 10) {
      conclusion = "轻度焦虑";
      details = {
        level: "轻度",
        description: "存在一定的焦虑倾向,建议加强关注,必要时咨询专业人士。"
      };
    } else {
      conclusion = "正常范围";
      details = {
        level: "正常",
        description: "目前焦虑水平在正常范围内,未见明显异常。"
      };
    }

    return { totalScore, conclusion, details };
  }
};
```

**评分函数要点:**

1. **参数:** `answers: number[]` - 用户每题的分数数组
2. **返回值:** `{ totalScore, conclusion, details }`
3. **评分逻辑:** 根据量表手册的临床标准编写

---

## 📝 步骤4: 注册到全局量表库

### 4.1 更新注册表

编辑 `lib/schemas/core/registry.ts`:

```typescript
import type { ScaleDefinition } from "./types";
import { ABC_Scale } from "../autism/abc";
import { CARS_Scale } from "../autism/cars";
import { SRS_Scale } from "../autism/srs";
import { SNAP_Scale } from "../adhd/snap-iv";
import { ANXIETY_Scale } from "../anxiety/anxiety-scale";  // ✅ 新增导入

/** 所有已激活的量表 */
export const AllScales: ScaleDefinition[] = [
  ABC_Scale,
  CARS_Scale,
  SRS_Scale,
  SNAP_Scale,
  ANXIETY_Scale,  // ✅ 新增注册
];
```

### 4.2 创建索引文件(可选)

如果是新分类目录,创建 `lib/schemas/anxiety/index.ts`:

```typescript
export { ANXIETY_Scale } from "./anxiety-scale";
```

---

## 🤖 步骤5: 更新AI分诊提示词

### 5.1 更新分诊系统提示词

编辑 `lib/services/triageFlow.ts`,在 `TRIAGE_SYSTEM_PROMPT` 中添加新量表:

```typescript
export const TRIAGE_SYSTEM_PROMPT = `你是智伴童行平台极其温柔、专业的儿科分诊专家...

【量表ID字典】
- ABC：孤独症行为评定量表(广筛,57题,15分钟)
- CARS：卡氏儿童孤独症评定量表(诊断,15题,5分钟)
- SRS：社交反应量表(深度社交,65题,10分钟)
- SNAP-IV：注意力量表(多动/注意力,26题,5分钟)
- ANXIETY：儿童焦虑量表(焦虑症状,20题,8分钟)  // ✅ 新增
...
`;
```

### 5.2 更新症状匹配规则

在分诊逻辑中添加新量表的症状关键词:

```typescript
// 如果用户提到以下症状,推荐 ANXIETY 量表
const anxietyKeywords = ['紧张', '焦虑', '害怕', '恐惧', '不安', '担心'];
```

---

## 🧪 步骤6: 测试验证

### 6.1 创建测试脚本

创建 `test-new-scale.mjs`:

```javascript
// 测试新量表
import { ANXIETY_Scale } from './lib/schemas/anxiety/anxiety-scale.ts';

console.log('=== 量表基本信息 ===');
console.log('ID:', ANXIETY_Scale.id);
console.log('名称:', ANXIETY_Scale.title);
console.log('题目数:', ANXIETY_Scale.questions.length);

console.log('\n=== 第一题详情 ===');
const q1 = ANXIETY_Scale.questions[0];
console.log('题号:', q1.id);
console.log('学术版:', q1.text);
console.log('大白话:', q1.colloquial);
console.log('临床意图:', q1.clinical_intent);
console.log('选项:', q1.options);

console.log('\n=== 评分测试 ===');
// 模拟用户答案: 前10题选"经常"(2分), 后10题选"偶尔"(1分)
const testAnswers = [...Array(10).fill(2), ...Array(10).fill(1)];
const result = ANXIETY_Scale.calculateScore(testAnswers);
console.log('总分:', result.totalScore);
console.log('结论:', result.conclusion);
console.log('详细:', result.details);
```

运行测试:

```bash
node test-new-scale.mjs
```

### 6.2 端到端测试

1. **启动开发服务器**

```bash
npm run dev
```

2. **测试语音交互流程**
   - 进入分诊界面
   - 提及相关症状
   - 验证AI是否推荐新量表
   - 完成量表答题
   - 检查评分结果

---

## ✅ 步骤7: 完整检查清单

在提交代码前,请确认以下项目:

- [ ] **文件结构**
  - [ ] 量表文件已创建在正确目录
  - [ ] 文件命名符合规范(小写-连字符)
  - [ ] 如有新分类,已创建索引文件

- [ ] **4D结构完整性**
  - [ ] 所有题目都有 `id`, `text`, `clinical_intent`, `colloquial`, `fallback_examples`, `options`
  - [ ] `fallback_examples` 至少包含1个追问示例
  - [ ] 选项分数设置正确

- [ ] **评分逻辑**
  - [ ] `calculateScore` 函数实现正确
  - [ ] 临床判定标准符合量表手册
  - [ ] 返回值格式符合 `ScaleScoreResult` 接口

- [ ] **全局注册**
  - [ ] 已在 `registry.ts` 中导入
  - [ ] 已在 `AllScales` 数组中注册

- [ ] **AI分诊**
  - [ ] 已更新 `TRIAGE_SYSTEM_PROMPT`
  - [ ] 已添加症状关键词映射
  - [ ] AI能正确推荐新量表

- [ ] **测试验证**
  - [ ] 单元测试通过
  - [ ] 评分逻辑测试通过
  - [ ] 端到端测试通过

---

## 📚 完整示例: 添加"儿童抑郁量表"

下面是完整的示例代码:

### 文件: `lib/schemas/depression/cds.ts`

```typescript
import type { ScaleDefinition, ScaleQuestion } from "../core/types";

const createOptions = () => [
  { label: "从不", score: 0 },
  { label: "有时", score: 1 },
  { label: "经常", score: 2 },
  { label: "总是", score: 3 }
];

const CDS_QUESTIONS: ScaleQuestion[] = [
  { 
    id: 1, 
    text: '感到悲伤或不开心', 
    clinical_intent: '评估核心抑郁情绪',
    colloquial: '宝宝最近是不是经常看起来不高兴,好像很难过?',
    fallback_examples: [
      '比如没什么事情能让他开心起来?',
      '是不是经常一个人发呆,看起来情绪低落?'
    ],
    options: createOptions() 
  },
  { 
    id: 2, 
    text: '对以前喜欢的事情失去兴趣', 
    clinical_intent: '评估快感缺失症状',
    colloquial: '宝宝以前喜欢玩的玩具或者游戏,现在是不是都不感兴趣了?',
    fallback_examples: [
      '比如以前喜欢的动画片,现在也不想看了?',
      '是不是对什么都没劲,不想动?'
    ],
    options: createOptions() 
  },
  // ... 继续添加所有题目
];

export const CDS_Scale: ScaleDefinition = {
  id: "CDS",
  version: "1.0",
  title: "儿童抑郁量表 (Children's Depression Scale)",
  description: "用于评估儿童抑郁症状的严重程度,包括情绪低落、兴趣减退、自我评价低等维度。",
  questions: CDS_QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    const totalScore = answers.reduce((sum, score) => sum + score, 0);
    
    let conclusion: string;
    let details = { level: "", description: "" };

    if (totalScore >= 40) {
      conclusion = "重度抑郁";
      details = {
        level: "重度",
        description: "抑郁症状非常严重,必须立即寻求儿童精神科专业帮助,建议进行系统的心理治疗和药物干预。"
      };
    } else if (totalScore >= 25) {
      conclusion = "中度抑郁";
      details = {
        level: "中度",
        description: "存在明显的抑郁症状,强烈建议尽快咨询儿童心理科或精神科医生进行专业评估。"
      };
    } else if (totalScore >= 15) {
      conclusion = "轻度抑郁";
      details = {
        level: "轻度",
        description: "存在一定的抑郁倾向,建议加强关注,必要时咨询专业心理医生。"
      };
    } else {
      conclusion = "正常范围";
      details = {
        level: "正常",
        description: "目前抑郁水平在正常范围内,未见明显异常。"
      };
    }

    return { totalScore, conclusion, details };
  }
};
```

### 更新: `lib/schemas/core/registry.ts`

```typescript
import { CDS_Scale } from "../depression/cds";

export const AllScales: ScaleDefinition[] = [
  ABC_Scale,
  CARS_Scale,
  SRS_Scale,
  SNAP_Scale,
  CDS_Scale,  // ✅ 新增
];
```

---

## 🔍 常见问题

### Q1: 量表选项分数如何确定?

**A:** 参考量表原始文献和手册:
- 李克特量表: 通常 0-3 或 1-4 分
- 是/否量表: 根据权重设置分数(如 ABC 量表每题权重不同)

### Q2: `colloquial` 如何编写?

**A:** 遵循原则:
- ✅ 口语化,像朋友聊天
- ✅ 使用"宝宝"等亲昵称呼
- ✅ 具体场景化描述
- ❌ 避免专业术语
- ❌ 避免书面语

**对比:**
```typescript
// ❌ 不好
colloquial: "该儿童是否表现出对学校环境的恐惧?"

// ✅ 好
colloquial: "宝宝是不是不愿意去学校,甚至害怕去学校?"
```

### Q3: `fallback_examples` 多少个合适?

**A:** 建议 1-3 个:
- 1个: 简单题目
- 2个: 中等复杂度
- 3个: 复杂或容易混淆的题目

### Q4: 如何验证评分逻辑?

**A:** 使用边界值测试:
```typescript
// 测试临界值
const testCases = [
  { answers: [...Array(20).fill(1)], expected: "轻度" },
  { answers: [...Array(20).fill(2)], expected: "中度" },
  { answers: [...Array(20).fill(3)], expected: "重度" },
];
```

---

## 📞 技术支持

如有疑问,请查看:
- **核心类型定义**: `lib/schemas/core/types.ts`
- **现用量表示例**: `lib/schemas/autism/abc.ts`
- **注册机制**: `lib/schemas/core/registry.ts`
- **分诊逻辑**: `lib/services/triageFlow.ts`

---

**🎉 完成以上步骤后,新量表即可在系统中使用!**
