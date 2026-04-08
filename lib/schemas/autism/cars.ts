import type { ExecutableScaleDefinition, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：生成 CARS 专用的 1-4 分选项
 */
const createCARSOptions = () => [
  { label: "1分：与年龄相当 (正常)", score: 1 },
  { label: "2分：轻度异常 (偶尔、轻微)", score: 2 },
  { label: "3分：中度异常 (经常、需要干预)", score: 3 },
  { label: "4分：严重异常 (极频、难以打断)", score: 4 }
];

// 完整 15 个维度的 4D 结构化数据
const CARS_QUESTIONS: ScaleQuestion[] = [
  { 
    id: 1, text: '人际关系（如缺乏眼光接触、回避他人或过度依赖）', 
    clinical_intent: '评估社交互动、眼神接触及对人的依恋状态',
    colloquial: '宝宝平时跟人亲不亲？您叫他或者看着他的时候，他会看您的眼睛回应吗？',
    fallback_examples: ['他会不会总是自己玩自己的，故意躲开别人的眼神？', '或者走向另一个极端，像块膏药一样死死粘着大人不放？'],
    options: createCARSOptions() 
  },
  { 
    id: 2, text: '模仿语言和动作（如很少用语言或动作模仿他人）', 
    clinical_intent: '评估对他人言语和动作的社会性模仿能力',
    colloquial: '大人平时做些简单的动作，或者教他说话，宝宝会跟着学吗？',
    fallback_examples: ['比如教他挥手说“拜拜”，或者假装打电话，他能模仿出来吗？'],
    options: createCARSOptions() 
  },
  { 
    id: 3, text: '情感反应（如情绪反应受限、过分，或与外界刺激无关）', 
    clinical_intent: '评估情绪表达的适当性与情境的匹配度',
    colloquial: '宝宝高兴或者不高兴的时候，反应跟普通孩子一样吗？',
    fallback_examples: ['会不会有时候明明没什么事，他却毫无原因地大哭或者大笑？', '或者遇到该高兴的事，他却一点反应都没有？'],
    options: createCARSOptions() 
  },
  { 
    id: 4, text: '躯体运用能力（如摇动、旋转、脚尖行走或缺乏协调性）', 
    clinical_intent: '评估大运动协调性及是否存在本体觉相关的刻板动作',
    colloquial: '宝宝平时走路、跑跳协调吗？有没有一些特别的小动作？',
    fallback_examples: ['比如经常踮着脚尖走路、原地转圈圈，或者坐在那里不停地摇晃身体？'],
    options: createCARSOptions() 
  },
  { 
    id: 5, text: '与非生命物体的关系（如对物体不适当使用、反复转动或着迷）', 
    clinical_intent: '评估对物品的异常依恋、非功能性游戏或刻板使用',
    colloquial: '宝宝玩玩具的方式正常吗？比如拿小汽车在地上推着玩？',
    fallback_examples: ['他是不是特别喜欢盯着某个零件看（比如转动的车轮），或者喜欢把东西排成一条长长的直线？'],
    options: createCARSOptions() 
  },
  { 
    id: 6, text: '对环境变化的适应（如环境改变时产生强烈反应或拒绝改变）', 
    clinical_intent: '评估对同一性的坚持和对环境改变的不耐受',
    colloquial: '如果家里换了家具的位置，或者每天出门的路线变了，他会发很大的脾气吗？',
    fallback_examples: ['他是不是对每天做事的顺序有严格的“死规矩”，一点点改变都很难接受？'],
    options: createCARSOptions() 
  },
  { 
    id: 7, text: '视觉反应（如经常凝视空间、盯着看发光/旋转物体，或着迷于"余光"观察）', 
    clinical_intent: '评估视觉注视异常、视觉敏感或寻求',
    colloquial: '宝宝会不会经常发呆，盯着一个地方看很久？',
    fallback_examples: ['他是不是喜欢用眼角的余光斜着看东西？', '或者对发光、旋转的东西特别着迷，看半天都不肯走？'],
    options: createCARSOptions() 
  },
  { 
    id: 8, text: '听觉反应（如对某些声音极度敏感，或对呼唤毫无反应）', 
    clinical_intent: '评估听觉敏感度及听觉注意力（听而不闻）',
    colloquial: '叫他名字的时候，他是不是经常像没听见一样，连头都不抬？',
    fallback_examples: ['但是他又会不会对某些特别的声音（比如吸尘器、吹风机或者冲马桶的声音）特别害怕，甚至捂住耳朵？'],
    options: createCARSOptions() 
  },
  { 
    id: 9, text: '近处感觉反应（如过度吸吮、舔、闻物品，或完全忽视疼痛）', 
    clinical_intent: '评估异常感官探索（触觉、味觉、嗅觉）及痛觉迟钝',
    colloquial: '宝宝拿到一个新东西，是不是喜欢先闻一闻，或者放在嘴里舔一舔、咬一咬？',
    fallback_examples: ['他如果不小心摔倒磕青了，是不是好像感觉不到疼，也不怎么哭？'],
    options: createCARSOptions() 
  },
  { 
    id: 10, text: '焦虑反应（如经常表现出无故的严重害怕、退缩）', 
    clinical_intent: '评估异常的恐惧体验或焦虑水平',
    colloquial: '宝宝会不会经常表现得很害怕、很紧张，但其实周围并没有什么吓人的东西？',
    fallback_examples: ['这种毫无由来的害怕，是不是即使您抱着哄也很难安抚下来？'],
    options: createCARSOptions() 
  },
  { 
    id: 11, text: '语言交流（如模仿言语、词不达意、发出类似噪音的声音或无语言）', 
    clinical_intent: '评估言语沟通的异常程度及语用能力',
    colloquial: '宝宝现在的说话能力怎么样？能用完整的句子跟您正常交流吗？',
    fallback_examples: ['他会不会经常重复大人刚说过的话（像小鹦鹉一样），或者总说一些大人听不懂的“外星语”？'],
    options: createCARSOptions() 
  },
  { 
    id: 12, text: '非语言交流（如缺乏手势交流，或出现古怪不可理解的面部表情）', 
    clinical_intent: '评估手势及面部表情等非言语沟通能力',
    colloquial: '宝宝想要什么东西的时候，如果说不出来，会用手指给您看吗？',
    fallback_examples: ['他平时脸上的表情丰富自然吗？会不会经常面无表情，让您猜不透他在想什么？'],
    options: createCARSOptions() 
  },
  { 
    id: 13, text: '活动水平（如多动、一直动个不停，或极其冷淡、活动缓慢）', 
    clinical_intent: '评估多动或活动过少的极端表现',
    colloquial: '宝宝平时的活动量是特别好动、一刻也停不下来，还是特别不爱动、显得懒洋洋的？',
    fallback_examples: ['这种活动量，您是不是感觉比一般的孩子极端很多，很难安静或者很难调动起来？'],
    options: createCARSOptions() 
  },
  { 
    id: 14, text: '智力功能（如某些特定技能表现出在年龄水平以上或不寻常的特殊能力）', 
    clinical_intent: '评估智力发展的不平衡性（孤岛能力）',
    colloquial: '宝宝在某一方面是不是特别聪明？比如拼图特别厉害、或者能记住很多数字和车标？',
    fallback_examples: ['虽然这方面很厉害，但普通的穿衣吃饭、和小朋友玩等生活技能却不太好？'],
    options: createCARSOptions() 
  },
  { 
    id: 15, text: '总的印象（填写者对孩子整体状况的主观判定）', 
    clinical_intent: '评估者对孤独症程度的整体临床判断',
    colloquial: '综合刚刚聊的所有这些表现，您主观上感觉孩子整体看起来，跟其他普通孩子差别大吗？',
    fallback_examples: ['您觉得他的异常情况是只有一点点，还是比较明显，或者是让您非常担心的程度？'],
    options: createCARSOptions() 
  }
];

export const CARS_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "CARS",
  version: "1.0",  // ✅ 新增版本号
  title: {
    zh: "卡氏儿童孤独症评定量表 (CARS)",
    en: "Childhood Autism Rating Scale (CARS)"
  },
  description: {
    zh: "用于评估和诊断儿童孤独症的严重程度，涵盖人际关系、视觉反应、情感表现等15个核心维度的行为表现。满分60分，正常范围<30分。",
    en: "A diagnostic scale for rating autism severity across 15 core behavioral dimensions."
  },
  category: "Child Development",
  tags: ["儿童发育", "孤独症", "诊断", "自闭症"],
  questions: CARS_QUESTIONS,
  
  calculateScore: (answers: number[]) => {
    // 防止传参长度不对，CARS 最低分为全选 1 分 (即 15 分)
    const safeAnswers = answers.length === 15 ? answers : [...answers, ...Array(15 - answers.length).fill(1)];
    
    // 直接累加得分
    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);
    
    let conclusion: string;
    let detailsStr = `【CARS总分】: ${totalScore}/60分\n\n`;

    // 完美对接你的临床分级标准
    if (totalScore >= 37) {
      conclusion = "重度异常征象";
      detailsStr += "临床建议：表现出非常多的孤独症征象，强烈建议立即进行全面的医疗干预和儿童精神专科深度评估。";
    } else if (totalScore >= 30) {
      conclusion = "轻/中度异常征象";
      detailsStr += "临床建议：呈现出孤独症的中度征象，建议结合临床医生面诊进一步确认，并考虑早期干预。";
    } else {
      conclusion = "正常范围/非典型";
      detailsStr += "临床建议：总分在正常范围内（低于30分），暂未达到典型孤独症的筛查界限，建议保持观察。";
    }

    return { 
      totalScore, 
      conclusion, 
      details: {
        description: detailsStr
      } 
    };
  }
};
