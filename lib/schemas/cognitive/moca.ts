import type {
  ExecutableScaleDefinition,
  ScaleOption,
  ScaleQuestion,
  ScaleScoreResult,
} from "../core/types";

const createMoCAOptions = (): ScaleOption[] => [
  {
    label: "正确",
    score: 1,
    aliases: ["通过", "答对", "符合标准"],
    description: "回答完全正确或动作符合规范",
  },
  {
    label: "错误",
    score: 0,
    aliases: ["不通过", "答错", "未完成"],
    description: "回答错误、不完整或动作不符合规范",
  },
];

export const MoCA_Scale: ExecutableScaleDefinition = {
  id: "MoCA_30",
  version: "1.0",
  title: {
    zh: "蒙特利尔认知评估 (MoCA)",
    en: "Montreal Cognitive Assessment (MoCA)",
  },
  description: {
    zh: "MoCA 用于对轻度认知功能异常进行快速筛查，评定注意与集中、执行功能、记忆、语言、视结构技能、抽象思维、计算和定向力等多个认知领域。总分 30 分，通常正常值为≥26分。",
    en: "The Montreal Cognitive Assessment (MoCA) is a rapid screening instrument for mild cognitive dysfunction.",
  },
  category: "Cognitive Health",
  source: "builtin",
  tags: ["认知功能", "MCI筛查", "痴呆早期筛查", "MoCA", "老年健康"],
  estimatedMinutes: 10,
  interactionMode: "manual_only",
  supportedLanguages: ["zh"],
  requiresConfirmation: false,
  questions: [
    {
      id: 1,
      text: "【视空间与执行功能】交替连线测验（1-甲-2-乙-3-丙-4-丁-5-戊）",
      clinical_intent: "评估执行功能和认知灵活性",
      colloquial: "请您按从数字到汉字交替的顺序连线：1-甲-2-乙-3-丙-4-丁-5-戊。",
      fallback_examples: ["完全按顺序连对且没有明显错误，记 1 分。"],
      imageUrl: "/scales/moca/visuospatial-executive.svg",
      imageAlt: "MoCA 视空间与执行功能题图：交替连线与立方体复制",
      options: createMoCAOptions(),
    },
    {
      id: 2,
      text: "【视空间与执行功能】复制立方体",
      clinical_intent: "评估视空间结构技能",
      colloquial: "请照着图上的样子，画出一个和原图一样的立方体。",
      fallback_examples: ["结构完整、线条合理、立体关系正确时记 1 分。"],
      imageUrl: "/scales/moca/visuospatial-executive.svg",
      imageAlt: "MoCA 立方体复制原图",
      options: createMoCAOptions(),
    },
    {
      id: 3,
      text: "【视空间与执行功能】画钟表：轮廓（11点过10分）",
      clinical_intent: "评估画钟表任务中的轮廓完成情况",
      colloquial: "请画一个钟表，先把表盘轮廓画出来。",
      fallback_examples: ["轮廓为封闭圆形或近似圆形，可计分。"],
      imageUrl: "/scales/moca/clock-drawing.svg",
      imageAlt: "MoCA 画钟表任务原图",
      options: createMoCAOptions(),
    },
    {
      id: 4,
      text: "【视空间与执行功能】画钟表：数字",
      clinical_intent: "评估画钟表任务中的数字布局",
      colloquial: "请把钟表上的数字都标上去。",
      fallback_examples: ["数字完整、顺序和位置基本正确时记 1 分。"],
      imageUrl: "/scales/moca/clock-drawing.svg",
      imageAlt: "MoCA 画钟表任务原图",
      options: createMoCAOptions(),
    },
    {
      id: 5,
      text: "【视空间与执行功能】画钟表：指针",
      clinical_intent: "评估画钟表任务中的时间设定能力",
      colloquial: "请把指针画在 11 点过 10 分的位置。",
      fallback_examples: ["两根指针长度和方向正确时记 1 分。"],
      imageUrl: "/scales/moca/clock-drawing.svg",
      imageAlt: "MoCA 画钟表任务原图",
      options: createMoCAOptions(),
    },
    {
      id: 6,
      text: "【命名】指出动物 1（狮子）",
      clinical_intent: "评估视觉识别与语义命名能力",
      colloquial: "请告诉我图中第一个动物叫什么名字。",
      fallback_examples: ["正确答案：狮子。"],
      imageUrl: "/scales/moca/naming-animals.png",
      imageAlt: "MoCA 命名题原图：狮子、犀牛、骆驼",
      options: createMoCAOptions(),
    },
    {
      id: 7,
      text: "【命名】指出动物 2（犀牛）",
      clinical_intent: "评估视觉识别与语义命名能力",
      colloquial: "请告诉我图中第二个动物叫什么名字。",
      fallback_examples: ["正确答案：犀牛。"],
      imageUrl: "/scales/moca/naming-animals.png",
      imageAlt: "MoCA 命名题原图：狮子、犀牛、骆驼",
      options: createMoCAOptions(),
    },
    {
      id: 8,
      text: "【命名】指出动物 3（骆驼）",
      clinical_intent: "评估视觉识别与语义命名能力",
      colloquial: "请告诉我图中第三个动物叫什么名字。",
      fallback_examples: ["正确答案：骆驼或单峰骆驼。"],
      imageUrl: "/scales/moca/naming-animals.png",
      imageAlt: "MoCA 命名题原图：狮子、犀牛、骆驼",
      options: createMoCAOptions(),
    },
    {
      id: 9,
      text: "【记忆】即刻记忆（面孔、天鹅绒、教堂、菊花、红色）",
      clinical_intent: "记录瞬时听觉词汇输入（本题不计分，仅作后续延迟回忆铺垫）",
      colloquial: "请先记住这五个词：面孔、天鹅绒、教堂、菊花、红色。稍后我还会再问您一次。",
      fallback_examples: ["本项仅作为引导步骤，不计入总分。"],
      options: [
        { label: "已完成引导", score: 0, aliases: ["完成", "继续"] },
        { label: "未完成", score: 0, aliases: ["拒绝", "中断"] },
      ],
    },
    {
      id: 10,
      text: "【注意】数字顺背 (2-1-8-5-4)",
      clinical_intent: "评估顺向注意力广度",
      colloquial: "请把我刚才读的数字，按同样顺序背出来：2-1-8-5-4。",
      fallback_examples: ["完全准确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 11,
      text: "【注意】数字倒背 (7-4-2)",
      clinical_intent: "评估逆向注意力与工作记忆",
      colloquial: "请把这串数字倒着说出来：7-4-2。",
      fallback_examples: ["正确答案是 2-4-7。"],
      options: createMoCAOptions(),
    },
    {
      id: 12,
      text: "【注意】警觉性测试（听到数字1敲桌子）",
      clinical_intent: "评估持续注意力",
      colloquial: "我会读一串数字，每听到数字 1 时，请您敲一下桌子。",
      fallback_examples: ["完全正确或只有 1 次错误记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 13,
      text: "【注意】连续减 7（100 连续减 7）",
      clinical_intent: "评估计算力与工作记忆",
      colloquial: "请从 100 开始连续减去 7，一直往下说。",
      fallback_examples: ["此项按正确个数分为 0-3 分。"],
      options: [
        { label: "4-5 个正确", score: 3, aliases: ["全对", "4个对"] },
        { label: "2-3 个正确", score: 2, aliases: ["2个对", "3个对"] },
        { label: "1 个正确", score: 1, aliases: ["对1个"] },
        { label: "全部错误", score: 0, aliases: ["全错", "不会"] },
      ],
    },
    {
      id: 14,
      text: "【语言】句子复述 1",
      clinical_intent: "评估句法与语言复述能力",
      colloquial: "请一字不差地重复这句话：“我只知道今天张亮是来帮过忙的人”。",
      fallback_examples: ["完全正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 15,
      text: "【语言】句子复述 2",
      clinical_intent: "评估复杂句法与语言复述能力",
      colloquial: "请再一字不差地重复这句话：“狗在房间的时候，猫总是躲在沙发下面”。",
      fallback_examples: ["完全正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 16,
      text: "【语言】词语流畅性（1分钟说动物）",
      clinical_intent: "评估词汇提取与执行发散功能",
      colloquial: "请在 1 分钟内尽可能多地说出动物名称。",
      fallback_examples: ["1 分钟内说出 11 个及以上动物名称记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 17,
      text: "【抽象】词语相似性 1（火车-自行车）",
      clinical_intent: "评估抽象概括能力",
      colloquial: "火车和自行车有什么共同点？它们同属于什么类别？",
      fallback_examples: ["回答交通工具、运输工具等记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 18,
      text: "【抽象】词语相似性 2（手表-尺子）",
      clinical_intent: "评估抽象概括能力",
      colloquial: "手表和尺子有什么共同点？它们同属于什么类别？",
      fallback_examples: ["回答测量工具、测量仪器等记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 19,
      text: "【延迟回忆】词语 1（面孔）",
      clinical_intent: "评估长时记忆检索（无提示回忆）",
      colloquial: "刚才那五个词，您还记得吗？本项看是否能自己想起“面孔”。",
      fallback_examples: ["未经提示自由回忆正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 20,
      text: "【延迟回忆】词语 2（天鹅绒）",
      clinical_intent: "评估长时记忆检索（无提示回忆）",
      colloquial: "本项看是否能自己想起“天鹅绒”。",
      fallback_examples: ["未经提示自由回忆正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 21,
      text: "【延迟回忆】词语 3（教堂）",
      clinical_intent: "评估长时记忆检索（无提示回忆）",
      colloquial: "本项看是否能自己想起“教堂”。",
      fallback_examples: ["未经提示自由回忆正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 22,
      text: "【延迟回忆】词语 4（菊花）",
      clinical_intent: "评估长时记忆检索（无提示回忆）",
      colloquial: "本项看是否能自己想起“菊花”。",
      fallback_examples: ["未经提示自由回忆正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 23,
      text: "【延迟回忆】词语 5（红色）",
      clinical_intent: "评估长时记忆检索（无提示回忆）",
      colloquial: "本项看是否能自己想起“红色”。",
      fallback_examples: ["未经提示自由回忆正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 24,
      text: "【定向】日期",
      clinical_intent: "评估时间定向力",
      colloquial: "请问今天是几号？",
      fallback_examples: ["回答精确日期才记分。"],
      options: createMoCAOptions(),
    },
    {
      id: 25,
      text: "【定向】月份",
      clinical_intent: "评估时间定向力",
      colloquial: "请问现在是几月份？",
      fallback_examples: ["回答正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 26,
      text: "【定向】年代（年份）",
      clinical_intent: "评估时间定向力",
      colloquial: "请问今年是哪一年？",
      fallback_examples: ["回答正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 27,
      text: "【定向】星期几",
      clinical_intent: "评估时间定向力",
      colloquial: "请问今天是星期几？",
      fallback_examples: ["回答正确记 1 分。"],
      options: createMoCAOptions(),
    },
    {
      id: 28,
      text: "【定向】地点",
      clinical_intent: "评估空间定向力",
      colloquial: "我们现在所在的这个地方叫什么名字？",
      fallback_examples: ["必须回答比较精确的地点名称。"],
      options: createMoCAOptions(),
    },
    {
      id: 29,
      text: "【定向】城市",
      clinical_intent: "评估空间定向力",
      colloquial: "我们现在所在的城市是哪里？",
      fallback_examples: ["回答正确记 1 分。"],
      options: createMoCAOptions(),
    },
  ],
  calculateScore: (answers: number[]): ScaleScoreResult => {
    const safeAnswers =
      answers.length === 29
        ? answers
        : [...answers.slice(0, 29), ...Array(Math.max(0, 29 - answers.length)).fill(0)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let riskLevel: "normal" | "sensitive" | "high" = "normal";
    let conclusion = "";

    if (totalScore >= 26) {
      riskLevel = "normal";
      conclusion = "认知功能正常";
    } else if (totalScore >= 18) {
      riskLevel = "sensitive";
      conclusion = "轻度认知功能障碍风险";
    } else {
      riskLevel = "high";
      conclusion = "显著认知功能缺陷";
    }

    return {
      totalScore,
      conclusion,
      details: {
        riskLevel,
        description: `MoCA 满分 30 分，当前原始得分为 ${totalScore} 分。一般来说，得分 ≥26 分提示认知功能处于正常范围；低于 26 分提示可能存在轻度认知功能异常，需要结合临床进一步判断。`,
        TODO_PDF_CHECK:
          "如果受教育年限≤12年，临床上通常需在原始总分基础上加 1 分（总分不超过 30 分）。当前实现未直接自动加分，请结合受教育程度做最终解释。",
      },
    };
  },
};
