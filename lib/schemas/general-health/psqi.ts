import type {
  ExecutableScaleDefinition,
  ScaleOption,
  ScaleQuestion,
  ScaleScoreResult,
} from "../core/types";

const createFrequencyOptions = (): ScaleOption[] => [
  {
    label: "过去 1 个月没有",
    score: 0,
    aliases: ["没有", "从不", "无"],
  },
  {
    label: "每周平均不足 1 个晚上",
    score: 1,
    aliases: ["很少", "偶尔", "不到一晚", "不到一天", "不足一次"],
  },
  {
    label: "每周平均 1-2 个晚上",
    score: 2,
    aliases: ["一两天", "一两个晚上", "有时", "两三天"],
  },
  {
    label: "每周平均 3 个或更多晚上",
    score: 3,
    aliases: ["经常", "三个晚上", "三天以上", "多数时候", "总是"],
  },
];

const createBedtimeOptions = (): ScaleOption[] => [
  { label: "晚上 8 点或更早", score: 20, aliases: ["八点", "八点前"] },
  { label: "晚上 8 点-9 点", score: 20.5, aliases: ["八点多", "八点半"] },
  { label: "晚上 9 点-10 点", score: 21.5, aliases: ["九点多", "九点半"] },
  { label: "晚上 10 点-11 点", score: 22.5, aliases: ["十点多", "十点半"] },
  { label: "晚上 11 点-12 点", score: 23.5, aliases: ["十一点多", "十一点半", "子夜"] },
  { label: "凌晨 0 点-1 点", score: 24.5, aliases: ["零点", "十二点多", "半夜"] },
  { label: "凌晨 1 点-2 点", score: 25.5, aliases: ["一点多", "一点半"] },
  { label: "凌晨 2 点或更晚", score: 26.5, aliases: ["两点多", "两点后", "深夜"] },
];

const createWakeTimeOptions = (): ScaleOption[] => [
  { label: "早上 5 点或更早", score: 4.5, aliases: ["五点", "五点前", "很早"] },
  { label: "早上 5 点-6 点", score: 5.5, aliases: ["五点多", "五点半"] },
  { label: "早上 6 点-7 点", score: 6.5, aliases: ["六点多", "六点半"] },
  { label: "早上 7 点-8 点", score: 7.5, aliases: ["七点多", "七点半"] },
  { label: "早上 8 点-9 点", score: 8.5, aliases: ["八点多", "八点半"] },
  { label: "早上 9 点-10 点", score: 9.5, aliases: ["九点多", "九点半"] },
  { label: "早上 10 点或更晚", score: 10.5, aliases: ["十点以后", "中午"] },
];

const createSleepDurationOptions = (): ScaleOption[] => [
  { label: "大于 7 小时", score: 7.5, aliases: ["七个多小时", "八小时", "很久"] },
  { label: "6-7 小时（不含 6 小时）", score: 6.5, aliases: ["六个多小时", "六个半小时"] },
  { label: "5-6 小时（含 6 小时）", score: 5.5, aliases: ["五个多小时", "六小时"] },
  { label: "小于 5 小时", score: 4.5, aliases: ["不到五小时", "四个小时", "很少"] },
];

export const PSQI_Scale: ExecutableScaleDefinition = {
  id: "PSQI_18",
  version: "1.0",
  title: {
    zh: "匹兹堡睡眠质量指数 (PSQI)",
    en: "Pittsburgh Sleep Quality Index (PSQI)",
  },
  description: {
    zh: "匹兹堡睡眠质量指数（PSQI）用于评估受测者近 1 个月的睡眠质量，涵盖入睡时间、睡眠时长、睡眠效率、睡眠障碍和日间功能等多个维度。",
    en: "PSQI measures sleep quality and sleep disturbance over the past month.",
  },
  category: "General Health",
  source: "builtin",
  tags: ["睡眠质量", "失眠", "PSQI", "健康评估"],
  estimatedMinutes: 10,
  interactionMode: "voice_guided",
  supportedLanguages: ["zh"],
  requiresConfirmation: false,
  questions: [
    {
      id: 1,
      text: "过去 1 个月，你通常上床睡觉的时间是几点？",
      clinical_intent: "评估日常作息规律（上床时间）",
      colloquial: "过去这一个月，你晚上一般是几点上床准备睡觉的？",
      fallback_examples: ["比如是晚上十点，还是拖到凌晨十二点以后？"],
      options: createBedtimeOptions(),
    },
    {
      id: 2,
      text: "过去 1 个月，你每晚通常要多长时间才能入睡？",
      clinical_intent: "评估入睡潜伏期",
      colloquial: "过去一个月，你躺在床上之后，一般要花多长时间才能睡着？",
      fallback_examples: ["是躺下十几分钟就能睡着，还是要在床上翻来覆去一个多小时？"],
      options: [
        { label: "15 分钟以内", score: 0, aliases: ["很快", "沾枕头就睡", "十分钟"] },
        { label: "16-30 分钟", score: 1, aliases: ["半小时以内", "二十分钟"] },
        { label: "30-60 分钟", score: 2, aliases: ["半小时到一个小时", "很久"] },
        { label: "60 分钟以上", score: 3, aliases: ["一个多小时", "两小时", "很难睡着"] },
      ],
    },
    {
      id: 3,
      text: "过去 1 个月，每天早上通常什么时候起床？",
      clinical_intent: "评估日常作息规律（起床时间）",
      colloquial: "过去这一个月，你早上一般是几点起床？",
      fallback_examples: ["比如是早上六点多，还是睡到九点以后？"],
      options: createWakeTimeOptions(),
    },
    {
      id: 4,
      text: "过去 1 个月，你每晚实际睡眠的时间大约有多少小时？",
      clinical_intent: "评估实际睡眠总时长",
      colloquial: "过去这一个月，你每天晚上真正睡着的时间，加起来大概有几个小时？",
      fallback_examples: ["去掉你在床上没睡着的时间，真正睡着的时间有没有超过 7 个小时？"],
      options: createSleepDurationOptions(),
    },
    {
      id: 5,
      text: "不能在 30 分钟内入睡",
      clinical_intent: "评估入睡困难的频率",
      colloquial: "过去这一个月里，你是不是经常躺下半个小时了还睡不着？一周大概有几天？",
      fallback_examples: ["是不是因为入睡困难导致睡不好？"],
      options: createFrequencyOptions(),
    },
    {
      id: 6,
      text: "在晚上睡眠中醒来或早醒",
      clinical_intent: "评估睡眠维持困难",
      colloquial: "过去这一个月，你会经常半夜醒过来，或者早上很早就醒了睡不着吗？一周大概几次？",
      fallback_examples: ["有没有经常夜里醒来好几次？"],
      options: createFrequencyOptions(),
    },
    {
      id: 7,
      text: "晚上有无起床上洗手间",
      clinical_intent: "评估夜尿对睡眠的干扰",
      colloquial: "过去一个月，你晚上睡觉时会经常起夜上厕所吗？一周平均几天？",
      fallback_examples: ["有没有因为憋尿憋醒，或者习惯性起夜？"],
      options: createFrequencyOptions(),
    },
    {
      id: 8,
      text: "不舒服的呼吸",
      clinical_intent: "评估呼吸系统问题干扰睡眠",
      colloquial: "过去一个月，你会因为觉得呼吸不顺畅、憋气而影响睡眠吗？",
      fallback_examples: ["睡觉时有没有喘不上气的感觉？"],
      options: createFrequencyOptions(),
    },
    {
      id: 9,
      text: "大声咳嗽或打鼾",
      clinical_intent: "评估咳嗽或严重打鼾干扰睡眠",
      colloquial: "过去一个月，你会因为大声咳嗽或者打呼噜而睡不好吗？",
      fallback_examples: ["自己咳嗽咳醒，或者因为打鼾被憋醒？"],
      options: createFrequencyOptions(),
    },
    {
      id: 10,
      text: "感到寒冷",
      clinical_intent: "评估温度不适（寒冷）对睡眠的干扰",
      colloquial: "过去一个月，睡觉时会经常因为觉得冷而睡不好吗？",
      fallback_examples: ["半夜有没有被冻醒过？"],
      options: createFrequencyOptions(),
    },
    {
      id: 11,
      text: "感到太热",
      clinical_intent: "评估温度不适（太热）对睡眠的干扰",
      colloquial: "过去一个月，睡觉时会经常因为觉得太热、出汗而睡不好吗？",
      fallback_examples: ["半夜有没有热醒或者闷醒过？"],
      options: createFrequencyOptions(),
    },
    {
      id: 12,
      text: "做噩梦",
      clinical_intent: "评估噩梦干扰",
      colloquial: "过去一个月，你经常因为做噩梦而睡不好或者惊醒吗？",
      fallback_examples: ["一周大概有几个晚上会被梦吓醒？"],
      options: createFrequencyOptions(),
    },
    {
      id: 13,
      text: "出现疼痛",
      clinical_intent: "评估躯体疼痛干扰",
      colloquial: "过去一个月，你会因为身体哪里疼痛而影响睡眠吗？",
      fallback_examples: ["比如头痛、关节痛或者肚子痛导致睡不着？"],
      options: createFrequencyOptions(),
    },
    {
      id: 14,
      text: "其他影响睡眠的事情",
      clinical_intent: "评估其他未列举的干扰因素",
      colloquial: "除了上面这些，过去一个月还有没有其他事情让你睡不好？比如噪音、光线或者心里想事情？",
      fallback_examples: ["有没有其他让你失眠的烦心事？"],
      options: createFrequencyOptions(),
    },
    {
      id: 15,
      text: "你对过去 1 个月睡眠质量总的评价是？",
      clinical_intent: "评估主观睡眠质量",
      colloquial: "总体来说，你怎么评价自己过去一个月的睡眠质量？",
      fallback_examples: ["是觉得非常好，还是非常差？"],
      options: [
        { label: "非常好", score: 0, aliases: ["很好", "不错"] },
        { label: "尚好", score: 1, aliases: ["还可以", "一般偏上", "挺好"] },
        { label: "不好", score: 2, aliases: ["较差", "不太好"] },
        { label: "非常差", score: 3, aliases: ["很差", "糟糕透了"] },
      ],
    },
    {
      id: 16,
      text: "近 1 个月你用催眠药物的情况",
      clinical_intent: "评估助眠药物依赖性",
      colloquial: "过去这一个月，你有吃过安眠药或者助眠药物来帮助睡觉吗？",
      fallback_examples: ["一周大概需要吃几次药才能睡着？"],
      options: createFrequencyOptions(),
    },
    {
      id: 17,
      text: "过去 1 个月你在开车、吃饭或参加社会活动时难以保持清醒状态？",
      clinical_intent: "评估日间嗜睡程度",
      colloquial: "过去这一个月，你在白天坐车、吃饭或者跟人聊天的时候，有没有觉得很难保持清醒，总是犯困打瞌睡？",
      fallback_examples: ["白天有没有困得睁不开眼的时候？"],
      options: createFrequencyOptions(),
    },
    {
      id: 18,
      text: "过去 1 个月你在积极完成事情上有无困难？",
      clinical_intent: "评估日间功能障碍（精力与热情）",
      colloquial: "过去这一个月，你觉得自己在打起精神做事的时候，有困难吗？",
      fallback_examples: ["是不是觉得浑身没劲，提不起干活的兴趣？"],
      options: [
        { label: "没有困难", score: 0, aliases: ["没有", "完全没问题", "精力充沛"] },
        { label: "有一点困难", score: 1, aliases: ["轻微困难", "偶尔没精神"] },
        { label: "比较困难", score: 2, aliases: ["有点困难", "经常提不起劲"] },
        { label: "非常困难", score: 3, aliases: ["很难", "完全没精力", "什么都不想干"] },
      ],
    },
  ],
  calculateScore: (answers: number[]): ScaleScoreResult => {
    const safeAnswers =
      answers.length === 18
        ? answers
        : [...answers.slice(0, 18), ...Array(Math.max(0, 18 - answers.length)).fill(0)];

    const q1Bedtime = safeAnswers[0];
    const q2LatencyScore = safeAnswers[1];
    const q3WakeTime = safeAnswers[2];
    const q4SleepHoursVal = safeAnswers[3];

    const q5a = safeAnswers[4];
    const q5b = safeAnswers[5];
    const q5c = safeAnswers[6];
    const q5d = safeAnswers[7];
    const q5e = safeAnswers[8];
    const q5f = safeAnswers[9];
    const q5g = safeAnswers[10];
    const q5h = safeAnswers[11];
    const q5i = safeAnswers[12];
    const q5j = safeAnswers[13];

    const q6SubjectiveScore = safeAnswers[14];
    const q7MedsScore = safeAnswers[15];
    const q8DaytimeSleepy = safeAnswers[16];
    const q9DaytimeEnthusiasm = safeAnswers[17];

    const factorA = q6SubjectiveScore;

    const bSum = q2LatencyScore + q5a;
    let factorB = 0;
    if (bSum === 0) factorB = 0;
    else if (bSum <= 2) factorB = 1;
    else if (bSum <= 4) factorB = 2;
    else factorB = 3;

    let factorC = 0;
    if (q4SleepHoursVal === 7.5) factorC = 0;
    else if (q4SleepHoursVal === 6.5) factorC = 1;
    else if (q4SleepHoursVal === 5.5) factorC = 2;
    else factorC = 3;

    let timeInBed = q3WakeTime - q1Bedtime;
    if (timeInBed < 0) timeInBed += 24;
    if (timeInBed <= 0) timeInBed = 24;

    const efficiency = (q4SleepHoursVal / timeInBed) * 100;
    let factorD = 0;
    if (efficiency > 85) factorD = 0;
    else if (efficiency >= 75) factorD = 1;
    else if (efficiency >= 65) factorD = 2;
    else factorD = 3;

    const eSum = q5b + q5c + q5d + q5e + q5f + q5g + q5h + q5i + q5j;
    let factorE = 0;
    if (eSum === 0) factorE = 0;
    else if (eSum <= 9) factorE = 1;
    else if (eSum <= 18) factorE = 2;
    else factorE = 3;

    const factorF = q7MedsScore;

    const gSum = q8DaytimeSleepy + q9DaytimeEnthusiasm;
    let factorG = 0;
    if (gSum === 0) factorG = 0;
    else if (gSum <= 2) factorG = 1;
    else if (gSum <= 4) factorG = 2;
    else factorG = 3;

    const totalScore = factorA + factorB + factorC + factorD + factorE + factorF + factorG;

    let conclusion = "";
    let riskLevel: "normal" | "sensitive" | "high" = "normal";

    if (totalScore <= 5) {
      conclusion = "睡眠质量很好";
      riskLevel = "normal";
    } else if (totalScore <= 10) {
      conclusion = "睡眠质量较好";
      riskLevel = "normal";
    } else if (totalScore <= 15) {
      conclusion = "睡眠质量一般";
      riskLevel = "sensitive";
    } else {
      conclusion = "睡眠质量差";
      riskLevel = "high";
    }

    return {
      totalScore,
      conclusion,
      details: {
        riskLevel,
        description: `测评分数解析：您的总分为 ${totalScore} 分（满分 21 分）。PSQI 考察了近 1 个月的主观睡眠质量、入睡时间、睡眠时间、睡眠效率、睡眠障碍、催眠药物使用以及日间功能障碍共 7 个维度。得分越高，表示近期睡眠质量越差。`,
        factors: {
          factorA: `主观睡眠质量：${factorA} 分`,
          factorB: `入睡时间：${factorB} 分`,
          factorC: `睡眠时间：${factorC} 分`,
          factorD: `睡眠效率：${factorD} 分`,
          factorE: `睡眠障碍：${factorE} 分`,
          factorF: `催眠药物：${factorF} 分`,
          factorG: `日间功能：${factorG} 分`,
        },
        TODO_PDF_CHECK:
          "原版 PSQI 的第 1、3、4 题属于开放式时间填写。本实现为了适配当前系统的单选结构，使用了时间段离散化近似计算睡眠效率。若后续支持自由时间输入，应升级为更精确的原版算法。",
      },
    };
  },
};
