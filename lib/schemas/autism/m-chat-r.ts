import type {
  ExecutableScaleDefinition,
  ScaleOption,
  ScaleQuestion,
  ScaleScoreResult,
} from "../core/types";

// 通用计分规则（正向）：回答“否”表示风险，计 1 分；回答“是”计 0 分。
// 适用于除第 2、5、12 题外的所有题目。
const createStandardOptions = (): ScaleOption[] => [
  {
    label: "是",
    score: 0,
    aliases: ["是", "会", "有", "经常", "对", "没问题"],
  },
  {
    label: "否",
    score: 1,
    aliases: ["否", "不会", "没有", "不", "从不", "很少"],
  },
];

// 反向计分规则：回答“是”表示风险，计 1 分；回答“否”计 0 分。
// 仅适用于第 2、5、12 题。
const createReverseOptions = (): ScaleOption[] => [
  {
    label: "是",
    score: 1,
    aliases: ["是", "会", "有", "经常", "对"],
  },
  {
    label: "否",
    score: 0,
    aliases: ["否", "不会", "没有", "不", "从不"],
  },
];

const M_CHAT_R_QUESTIONS: ScaleQuestion[] = [
  {
    id: 1,
    text: "如果你指向房间内的某样物体，你的孩子会看它吗？(例如，你指着一个玩具或动物，你的孩子会看这个玩具或动物吗？)",
    clinical_intent: "评估联合注意中的响应性指点",
    colloquial: "如果你用手指着房间里的某个东西，宝宝会顺着你的手去看那个东西吗？",
    fallback_examples: ["比如你指着远处的玩具或者小猫小狗，他会顺着你的手势去看吗？"],
    options: createStandardOptions(),
  },
  {
    id: 2,
    text: "你有没有想过你的孩子可能是聋的？",
    clinical_intent: "评估对声音或呼名反应迟钝的情况（反向风险项）",
    colloquial: "你有没有曾经怀疑过，宝宝的听力是不是有问题，或者像是听不见？",
    fallback_examples: ["比如经常叫他都没反应，让你怀疑他是不是听不到？"],
    options: createReverseOptions(),
    riskLevel: "sensitive",
  },
  {
    id: 3,
    text: "你的孩子会玩假装游戏吗？(例如，假装从空的杯子中喝水，假装打电话，假装喂娃娃或毛绒玩具？)",
    clinical_intent: "评估象征性与假装游戏能力",
    colloquial: "宝宝会玩假装游戏吗？比如拿空杯子假装喝水，或者假装打电话？",
    fallback_examples: ["像是假装给布娃娃喂饭，或者拿个东西当成电话放在耳边？"],
    options: createStandardOptions(),
  },
  {
    id: 4,
    text: "你的孩子喜欢爬东西吗？(如家具、游乐场设施、或楼梯)",
    clinical_intent: "评估粗大运动发育和探索环境的意愿",
    colloquial: "宝宝平时喜欢爬高上低吗？比如爬沙发、爬楼梯或者游乐设施？",
    fallback_examples: ["他会不会主动爬家具或者想往高处去？"],
    options: createStandardOptions(),
  },
  {
    id: 5,
    text: "你的孩子会在离自己眼睛近的地方做出不正常的手指运动吗？(例如，你的孩子会在眼睛前摆动手指吗？)",
    clinical_intent: "评估刻板或重复性的手部动作（反向风险项）",
    colloquial: "宝宝会不会把手指靠眼睛很近，然后做出一些奇怪动作？比如在眼前晃手指？",
    fallback_examples: ["有没有经常把手举到眼前来回摆弄，像盯着自己的手看？"],
    options: createReverseOptions(),
    riskLevel: "sensitive",
  },
  {
    id: 6,
    text: "你的孩子会用一根手指指东西表示需要或寻求帮助吗？(例如，指着他/她够不到的一块点心或玩具)",
    clinical_intent: "评估需求性指点能力",
    colloquial: "当宝宝想要什么东西，比如够不到的零食或玩具时，他会伸出一根手指指给你看吗？",
    fallback_examples: ["想拿但是拿不到的时候，会不会用手指着让你帮忙？"],
    options: createStandardOptions(),
  },
  {
    id: 7,
    text: "你的孩子会用一根手指指东西，向你展示有趣的东西吗？(例如，指向天空中的飞机或马路上的卡车)",
    clinical_intent: "评估宣告性指点和分享兴趣的能力",
    colloquial: "看到好玩的东西时，比如天上的飞机，宝宝会主动用手指给你看吗？",
    fallback_examples: ["他会不会指着马路上的大车，让你也看一眼？"],
    options: createStandardOptions(),
  },
  {
    id: 8,
    text: "你的孩子对其他孩子感兴趣吗？(例如，你的孩子会看其他孩子，对他们笑，走向他们吗？)",
    clinical_intent: "评估对同龄人的社交兴趣",
    colloquial: "宝宝对别的小朋友感兴趣吗？会不会看他们、冲他们笑，或者主动走过去？",
    fallback_examples: ["在公园里看到别的小孩玩，他会想靠近或者盯着看吗？"],
    options: createStandardOptions(),
  },
  {
    id: 9,
    text: "你的孩子会把东西拿给你或举着东西给你看吗——不是寻求帮助，而只是分享？(例如，给你看花、毛绒玩具动物或玩具卡车)",
    clinical_intent: "评估主动分享兴趣的展示行为",
    colloquial: "宝宝会不会特地把东西拿来给你看，只是想跟你分享，而不是让你帮忙？",
    fallback_examples: ["比如捡到一片树叶，或者拿着喜欢的玩具，特意举给你看？"],
    options: createStandardOptions(),
  },
  {
    id: 10,
    text: "你叫孩子名字的时候，他/她会有反应吗？(例如，你叫他/她的名字，他/她会抬头、说话或咿呀说话，或者停下正在做的事？)",
    clinical_intent: "评估对呼名的反应",
    colloquial: "你叫宝宝名字的时候，他会不会有反应？比如抬头看你，或者停下手里正在做的事？",
    fallback_examples: ["从后面叫他的名字，他会回头看你吗？"],
    options: createStandardOptions(),
  },
  {
    id: 11,
    text: "你对你的孩子笑的时候，他/她会回笑吗？",
    clinical_intent: "评估社交性微笑的互动能力",
    colloquial: "当你冲着宝宝笑的时候，他会不会看着你回你一个笑容？",
    fallback_examples: ["你逗他的时候，他会不会跟着你笑？"],
    options: createStandardOptions(),
  },
  {
    id: 12,
    text: "你的孩子会因为日常噪音而感到不安吗？(例如，你的孩子会因为吸尘器或大分贝音乐而尖叫或哭吗？)",
    clinical_intent: "评估听觉感觉过度敏感（反向风险项）",
    colloquial: "宝宝会不会特别怕日常的噪音？比如吸尘器声、很大的音乐声，会让他吓得哭或者尖叫？",
    fallback_examples: ["家里吹风机、榨汁机这些声音，会不会让他特别不舒服甚至捂耳朵？"],
    options: createReverseOptions(),
    riskLevel: "sensitive",
  },
  {
    id: 13,
    text: "你的孩子会走路吗？",
    clinical_intent: "评估粗大运动发育水平",
    colloquial: "宝宝现在会自己走路了吗？",
    fallback_examples: ["他能不能独立走，不需要一直扶着？"],
    options: createStandardOptions(),
  },
  {
    id: 14,
    text: "当你对着他/她说话，和他/她玩耍，或者给他/她穿衣服时，他/她会与你对视吗？",
    clinical_intent: "评估日常互动中的目光接触",
    colloquial: "你平时跟宝宝说话、玩耍或者换衣服的时候，他会不会经常看着你的眼睛？",
    fallback_examples: ["面对面互动时，他会不会和你有眼神交流？"],
    options: createStandardOptions(),
  },
  {
    id: 15,
    text: "你的孩子会模仿你做的事吗？(例如，挥手再见、鼓掌或者发出有趣的声音)",
    clinical_intent: "评估动作和发声模仿能力",
    colloquial: "宝宝会不会学你做动作？比如你挥手拜拜，他也跟着挥手，或者你拍手他也拍手？",
    fallback_examples: ["你故意发出有趣声音时，他会不会跟着模仿？"],
    options: createStandardOptions(),
  },
  {
    id: 16,
    text: "如果你转头看某样东西，你的孩子也会向四周看，看你在看什么吗？",
    clinical_intent: "评估追视和跟随他人视线的能力",
    colloquial: "如果你突然转头去看旁边某个东西，宝宝会不会也跟着看你在看什么？",
    fallback_examples: ["比如你突然抬头看天花板，他也会顺着你的方向看吗？"],
    options: createStandardOptions(),
  },
  {
    id: 17,
    text: "你的孩子会试图让你去看他/她吗？(例如，你的孩子会看着你等待夸奖，或者说“看”、“看我”吗？)",
    clinical_intent: "评估主动寻求关注的社交行为",
    colloquial: "宝宝会不会主动叫你看他？比如做了一件事后，特意看着你等你表扬？",
    fallback_examples: ["他会不会跑来喊你“看我”，或者做出动作想让你注意他？"],
    options: createStandardOptions(),
  },
  {
    id: 18,
    text: "当你告诉你的孩子去做某事时，他/她能理解吗？(例如，如果你不用手指，你的孩子能理解“把书放在椅子上”或“给我拿毯子”吗？)",
    clinical_intent: "评估在缺乏手势提示时的语言理解能力",
    colloquial: "如果你只用嘴巴说，不用手指着，宝宝能听懂你的简单指令吗？",
    fallback_examples: ["比如你说“把鞋子拿过来”，他会不会听懂并照着做？"],
    options: createStandardOptions(),
  },
  {
    id: 19,
    text: "如果发生了新鲜事，你的孩子会看你的脸，来看你有什么感觉吗？(例如，如果他/她听到了奇怪或有趣的声音，他/她会看你的脸吗？)",
    clinical_intent: "评估社会参照能力",
    colloquial: "如果发生了什么新鲜事，或者听到奇怪声音，宝宝会不会先看你的脸，看看你的反应？",
    fallback_examples: ["遇到陌生或突然的情况时，他会不会先看看大人是什么表情？"],
    options: createStandardOptions(),
  },
  {
    id: 20,
    text: "你的孩子喜欢运动吗？(例如，在你的膝盖上摇晃或弹跳)",
    clinical_intent: "评估对互动性运动和前庭觉刺激的兴趣",
    colloquial: "宝宝喜欢和你一起做身体互动游戏吗？比如坐在你腿上颠一颠，或者被举高高？",
    fallback_examples: ["他会不会喜欢那种摇一摇、晃一晃的互动游戏？"],
    options: createStandardOptions(),
  },
];

export const M_CHAT_R_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "M_CHAT_R",
  version: "1.0",
  title: {
    zh: "改良版婴幼儿孤独症筛查量表 (M-CHAT-R)",
    en: "Modified Checklist for Autism in Toddlers, Revised (M-CHAT-R)",
  },
  description: {
    zh: "M-CHAT-R 是一个由家长完成的初筛工具，用于评估 16-30 个月婴幼儿的自闭症谱系障碍风险。请根据孩子平时的通常表现作答；如果某行为只偶尔出现，并不经常，请回答“否”。",
    en: "A parent-report screening tool for identifying autism spectrum risk in toddlers aged 16-30 months.",
  },
  category: "Child Development",
  tags: ["ASD", "自闭症", "孤独症", "婴幼儿发育", "筛查"],
  estimatedMinutes: 3,
  interactionMode: "voice_guided",
  resultDeliveryMode: "physician_review",
  supportedLanguages: ["zh"],
  requiresConfirmation: false,
  questions: M_CHAT_R_QUESTIONS,

  calculateScore: (answers: number[]): ScaleScoreResult => {
    const safeAnswers =
      answers.length === 20
        ? answers
        : [...answers.slice(0, 20), ...Array(Math.max(0, 20 - answers.length)).fill(0)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let conclusion = "";
    let description = "";
    let riskLevel: "Low" | "Medium" | "High" = "Low";

    if (totalScore <= 2) {
      riskLevel = "Low";
      conclusion = "低风险 (Low Risk)";
      description =
        "如果孩子小于 24 个月，建议在 2 岁时再次筛查。除非日常观察仍提示存在自闭症风险，否则通常不需要进一步处理。";
    } else if (totalScore <= 7) {
      riskLevel = "Medium";
      conclusion = "中等风险 (Medium Risk)";
      description =
        "建议继续进行后续随访问卷（M-CHAT-R/F）。如果随访结果仍提示阳性，应尽快安排专业诊断评估和发育评估，并考虑早期干预。";
    } else {
      riskLevel = "High";
      conclusion = "高风险 (High Risk)";
      description =
        "建议跳过后续追问，尽快安排专业的诊断评估和发育评估，以便尽早决定是否需要干预。";
    }

    return {
      totalScore,
      conclusion,
      details: {
        riskLevel,
        description,
        rule: "第 2、5、12 题回答“是”为风险项；其余题目回答“否”为风险项。每个风险项计 1 分。",
        TODO_PDF_CHECK:
          "原 PDF 包含 M-CHAT-R/F 后续访谈决策树。当前项目的线性问卷结构仅实现第一阶段 M-CHAT-R 初筛部分，未实现条件分支随访。",
      },
    };
  },
};
