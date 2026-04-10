import type { ExecutableScaleDefinition, LocalizedTextValue, ScaleQuestion } from "../core/types";

/**
 * 辅助函数：生成 CARS 专用的 1-4 分选项
 */
type CARSOptionDescriptions = [
  LocalizedTextValue?,
  LocalizedTextValue?,
  LocalizedTextValue?,
  LocalizedTextValue?,
];

const CARS_OPTION_META = [
  {
    label: "1分：与年龄相当 (正常)",
    score: 1,
    aliases: ["1分", "正常", "与年龄相当"],
  },
  {
    label: "2分：轻度异常 (偶尔、轻微)",
    score: 2,
    aliases: ["2分", "轻度异常", "轻度", "偶尔", "轻微"],
  },
  {
    label: "3分：中度异常 (经常、需要干预)",
    score: 3,
    aliases: ["3分", "中度异常", "中度", "经常", "需要干预"],
  },
  {
    label: "4分：严重异常 (极频、难以打断)",
    score: 4,
    aliases: ["4分", "严重异常", "严重", "极频", "难以打断"],
  },
] as const;

const createCARSOptions = (descriptions?: CARSOptionDescriptions) =>
  CARS_OPTION_META.map((option, index) => ({
    label: option.label,
    score: option.score,
    aliases: [...option.aliases],
    ...(descriptions?.[index] ? { description: descriptions[index] } : {}),
  }));

// 完整 15 个维度的 4D 结构化数据
const CARS_QUESTIONS: ScaleQuestion[] = [
  { 
    id: 1, text: '人际关系（如缺乏眼光接触、回避他人或过度依赖）', 
    clinical_intent: '评估社交互动、眼神接触及对人的依恋状态',
    colloquial: '宝宝平时跟人亲不亲？您叫他或者看着他的时候，他会看您的眼睛回应吗？',
    fallback_examples: ['他会不会总是自己玩自己的，故意躲开别人的眼神？', '或者走向另一个极端，像块膏药一样死死粘着大人不放？'],
    options: createCARSOptions([
      '与同龄孩子相比，人际互动基本自然，会看人、回应呼唤，也不过分回避或粘人。',
      '偶尔显得不太看人或不够主动，但多数时候仍能和大人、小朋友有基本互动。',
      '经常回避眼神、难以自然互动，或明显过分依赖大人，和同龄孩子差别较明显。',
      '大多数时候都缺乏正常人际互动，要么持续回避他人，要么极端依附，表现非常明显。',
    ]) 
  },
  { 
    id: 2, text: '模仿语言和动作（如很少用语言或动作模仿他人）', 
    clinical_intent: '评估对他人言语和动作的社会性模仿能力',
    colloquial: '大人平时做些简单的动作，或者教他说话，宝宝会跟着学吗？',
    fallback_examples: ['比如教他挥手说“拜拜”，或者假装打电话，他能模仿出来吗？'],
    options: createCARSOptions([
      '平时能模仿大人的动作和简单语言，比如挥手、点头、学说简单词句。',
      '有时能模仿，但反应稍慢或需要多次示范，整体只是轻微落后。',
      '经常不跟着模仿，大人反复教也学得较少，模仿能力明显偏弱。',
      '几乎不会模仿语言或动作，即使反复示范也很难学会。',
    ]) 
  },
  { 
    id: 3, text: '情感反应（如情绪反应受限、过分，或与外界刺激无关）', 
    clinical_intent: '评估情绪表达的适当性与情境的匹配度',
    colloquial: '宝宝高兴或者不高兴的时候，反应跟普通孩子一样吗？',
    fallback_examples: ['会不会有时候明明没什么事，他却毫无原因地大哭或者大笑？', '或者遇到该高兴的事，他却一点反应都没有？'],
    options: createCARSOptions([
      '情绪反应和当下情境大体匹配，高兴、难过、生气都比较自然。',
      '偶尔会出现反应偏淡或偏强，但大多数时候仍能和情境对得上。',
      '经常出现情绪反应不合时宜，或该有反应时太弱、没事时又过度激动。',
      '情绪反应大多明显异常，经常和外界情境脱节，让人很难理解。',
    ]) 
  },
  { 
    id: 4, text: '躯体运用能力（如摇动、旋转、脚尖行走或缺乏协调性）', 
    clinical_intent: '评估大运动协调性及是否存在本体觉相关的刻板动作',
    colloquial: '宝宝平时走路、跑跳协调吗？有没有一些特别的小动作？',
    fallback_examples: ['比如经常踮着脚尖走路、原地转圈圈，或者坐在那里不停地摇晃身体？'],
    options: createCARSOptions([
      '走路、跑跳和身体动作基本符合年龄水平，很少见到异常小动作。',
      '偶尔会踮脚、摇晃或动作显得有点别扭，但整体不算明显。',
      '经常出现踮脚、旋转、摇晃或动作协调差，已经影响日常活动表现。',
      '躯体动作异常非常明显且频繁，刻板动作多，或协调性问题很突出。',
    ]) 
  },
  { 
    id: 5, text: '与非生命物体的关系（如对物体不适当使用、反复转动或着迷）', 
    clinical_intent: '评估对物品的异常依恋、非功能性游戏或刻板使用',
    colloquial: '宝宝玩玩具的方式正常吗？比如拿小汽车在地上推着玩？',
    fallback_examples: ['他是不是特别喜欢盯着某个零件看（比如转动的车轮），或者喜欢把东西排成一条长长的直线？'],
    options: createCARSOptions([
      '玩玩具方式基本正常，能按用途玩，不会总盯着局部或重复摆弄。',
      '偶尔会对某个零件、排列方式特别在意，但仍有正常玩法。',
      '经常用不合常规的方式玩物品，如只转轮子、只排队列，功能性玩法明显不足。',
      '几乎总是以刻板、异常方式摆弄物品，对局部或重复操作非常着迷。',
    ]) 
  },
  { 
    id: 6, text: '对环境变化的适应（如环境改变时产生强烈反应或拒绝改变）', 
    clinical_intent: '评估对同一性的坚持和对环境改变的不耐受',
    colloquial: '如果家里换了家具的位置，或者每天出门的路线变了，他会发很大的脾气吗？',
    fallback_examples: ['他是不是对每天做事的顺序有严格的“死规矩”，一点点改变都很难接受？'],
    options: createCARSOptions([
      '面对日常小变化通常能适应，不会因为改变路线或顺序就明显失控。',
      '偶尔会因为变化不高兴，但提醒和安抚后一般还能接受。',
      '经常对环境或流程变化强烈抗拒，容易发脾气或明显不安。',
      '对很小的变化也难以接受，常出现剧烈情绪反应或完全拒绝改变。',
    ]) 
  },
  { 
    id: 7, text: '视觉反应（如经常凝视空间、盯着看发光/旋转物体，或着迷于"余光"观察）', 
    clinical_intent: '评估视觉注视异常、视觉敏感或寻求',
    colloquial: '宝宝会不会经常发呆，盯着一个地方看很久？',
    fallback_examples: ['他是不是喜欢用眼角的余光斜着看东西？', '或者对发光、旋转的东西特别着迷，看半天都不肯走？'],
    options: createCARSOptions([
      '视觉反应基本自然，不会经常发呆、斜眼看物或沉迷发光旋转物体。',
      '偶尔会盯着某处发呆或用余光看东西，但频率不高。',
      '经常出现发呆、余光观察或明显迷恋发光、旋转物体的情况。',
      '视觉反应异常非常明显，大量时间沉迷凝视、斜视或盯着特殊刺激不放。',
    ]) 
  },
  { 
    id: 8, text: '听觉反应（如对某些声音极度敏感，或对呼唤毫无反应）', 
    clinical_intent: '评估听觉敏感度及听觉注意力（听而不闻）',
    colloquial: '叫他名字的时候，他是不是经常像没听见一样，连头都不抬？',
    fallback_examples: ['但是他又会不会对某些特别的声音（比如吸尘器、吹风机或者冲马桶的声音）特别害怕，甚至捂住耳朵？'],
    options: createCARSOptions([
      '听觉反应大致正常，叫名字通常会回应，对日常声音也不过分敏感。',
      '偶尔叫名字反应慢，或对某些声音稍显敏感，但整体还算轻度。',
      '经常像没听见叫名，或对部分声音明显敏感、捂耳朵、退缩。',
      '听觉反应异常很明显，不是长期像听不见，就是对声音极度敏感难以承受。',
    ]) 
  },
  { 
    id: 9, text: '近处感觉反应（如过度吸吮、舔、闻物品，或完全忽视疼痛）', 
    clinical_intent: '评估异常感官探索（触觉、味觉、嗅觉）及痛觉迟钝',
    colloquial: '宝宝拿到一个新东西，是不是喜欢先闻一闻，或者放在嘴里舔一舔、咬一咬？',
    fallback_examples: ['他如果不小心摔倒磕青了，是不是好像感觉不到疼，也不怎么哭？'],
    options: createCARSOptions([
      '近距离感觉探索方式基本正常，不会总去闻、舔、咬，疼痛反应也大致正常。',
      '偶尔会闻、舔物品或对疼痛反应稍弱，但不算频繁。',
      '经常通过闻、舔、咬来探索东西，或对摔伤疼痛反应明显偏弱。',
      '近处感觉反应异常非常明显，频繁闻舔咬物或几乎忽视疼痛刺激。',
    ]) 
  },
  { 
    id: 10, text: '焦虑反应（如经常表现出无故的严重害怕、退缩）', 
    clinical_intent: '评估异常的恐惧体验或焦虑水平',
    colloquial: '宝宝会不会经常表现得很害怕、很紧张，但其实周围并没有什么吓人的东西？',
    fallback_examples: ['这种毫无由来的害怕，是不是即使您抱着哄也很难安抚下来？'],
    options: createCARSOptions([
      '害怕和退缩基本与情境相符，不会经常无故紧张或过度惊恐。',
      '偶尔会显得紧张、退缩，但通常还能较快安抚下来。',
      '经常出现无明显原因的害怕、退缩或焦虑，需要较多安抚。',
      '焦虑或退缩反应非常明显且频繁，常常毫无明显原因也很难安抚。',
    ]) 
  },
  { 
    id: 11, text: '语言交流（如模仿言语、词不达意、发出类似噪音的声音或无语言）', 
    clinical_intent: '评估言语沟通的异常程度及语用能力',
    colloquial: '宝宝现在的说话能力怎么样？能用完整的句子跟您正常交流吗？',
    fallback_examples: ['他会不会经常重复大人刚说过的话（像小鹦鹉一样），或者总说一些大人听不懂的“外星语”？'],
    options: createCARSOptions([
      '语言交流基本符合年龄，能较自然地表达需求并与人沟通。',
      '语言交流有些轻微异常，如偶尔仿说、表达不清，但还能基本沟通。',
      '经常仿说、词不达意、说怪声或句子明显异常，交流已经受影响。',
      '语言交流严重异常，几乎没有有效语言，或大部分表达难以理解。',
    ]) 
  },
  { 
    id: 12, text: '非语言交流（如缺乏手势交流，或出现古怪不可理解的面部表情）', 
    clinical_intent: '评估手势及面部表情等非言语沟通能力',
    colloquial: '宝宝想要什么东西的时候，如果说不出来，会用手指给您看吗？',
    fallback_examples: ['他平时脸上的表情丰富自然吗？会不会经常面无表情，让您猜不透他在想什么？'],
    options: createCARSOptions([
      '手势、指物和面部表情基本自然，能用非语言方式辅助沟通。',
      '偶尔缺少手势或表情稍显单调古怪，但还保留一定沟通功能。',
      '经常缺少指向手势或表情不自然，非语言交流明显受限。',
      '非语言交流异常非常明显，几乎不会用手势表达，表情也常让人难以理解。',
    ]) 
  },
  { 
    id: 13, text: '活动水平（如多动、一直动个不停，或极其冷淡、活动缓慢）', 
    clinical_intent: '评估多动或活动过少的极端表现',
    colloquial: '宝宝平时的活动量是特别好动、一刻也停不下来，还是特别不爱动、显得懒洋洋的？',
    fallback_examples: ['这种活动量，您是不是感觉比一般的孩子极端很多，很难安静或者很难调动起来？'],
    options: createCARSOptions([
      '活动水平基本符合年龄，既不过分亢奋，也不过分迟缓冷淡。',
      '活动量偶尔偏多或偏少，但只是轻度异常，不持续。',
      '活动水平经常明显偏高或偏低，已经让人觉得和普通孩子差别较大。',
      '活动水平极端异常，要么持续停不下来，要么明显过度冷淡迟缓。',
    ]) 
  },
  { 
    id: 14, text: '智力功能（如某些特定技能表现出在年龄水平以上或不寻常的特殊能力）', 
    clinical_intent: '评估智力发展的不平衡性（孤岛能力）',
    colloquial: '宝宝在某一方面是不是特别聪明？比如拼图特别厉害、或者能记住很多数字和车标？',
    fallback_examples: ['虽然这方面很厉害，但普通的穿衣吃饭、和小朋友玩等生活技能却不太好？'],
    options: createCARSOptions([
      '整体能力发展较均衡，没有特别突出的不寻常能力落差。',
      '某些方面略有不均衡，偶尔能看到局部偏强或偏弱。',
      '能力结构经常表现出明显不平衡，某些特殊技能和整体发展不太相称。',
      '智力功能不平衡非常明显，存在很突出的特殊能力或极不寻常的能力差异。',
    ]) 
  },
  { 
    id: 15, text: '总的印象（填写者对孩子整体状况的主观判定）', 
    clinical_intent: '评估者对孤独症程度的整体临床判断',
    colloquial: '综合刚刚聊的所有这些表现，您主观上感觉孩子整体看起来，跟其他普通孩子差别大吗？',
    fallback_examples: ['您觉得他的异常情况是只有一点点，还是比较明显，或者是让您非常担心的程度？'],
    options: createCARSOptions([
      '整体看起来与普通孩子差别不大，异常表现很少或不明显。',
      '整体有轻度异常，能看出和普通孩子有些不同，但程度还比较轻。',
      '整体异常已经比较明显，多方面表现都让人担心，需要重点关注。',
      '整体异常非常明显，家长或评估者会强烈担心，和普通孩子差别很大。',
    ]) 
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
