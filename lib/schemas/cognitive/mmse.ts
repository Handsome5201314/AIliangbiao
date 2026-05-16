import type {
  ExecutableScaleDefinition,
  ScaleOption,
  ScaleQuestion,
  ScaleScoreResult,
} from "../core/types";

const createMMSEOptions = (): ScaleOption[] => [
  {
    label: "正确",
    score: 1,
    aliases: ["答对", "做对了", "完成", "符合标准"],
    description: "回答正确或准确完成了指令动作",
  },
  {
    label: "错误",
    score: 0,
    aliases: ["答错", "不会", "拒绝回答", "未完成", "不符合标准"],
    description: "回答错误、不知晓或未按指令动作执行",
  },
];

export const MMSE_Scale: ExecutableScaleDefinition = {
  id: "MMSE_30",
  version: "1.0",
  title: {
    zh: "简易精神状态评价量表 (MMSE)",
    en: "Mini-Mental State Examination (MMSE)",
  },
  description: {
    zh: "MMSE 是临床上最常用的认知功能筛查工具之一，用于评估受测者的定向力、记忆力、注意力、计算力、语言能力和视空间能力。本量表需由评估员现场对受测者进行测试。",
    en: "The MMSE is a widely used clinical screening tool for cognitive impairment.",
  },
  category: "Cognitive Health",
  source: "builtin",
  tags: ["认知功能", "痴呆筛查", "阿尔茨海默症", "MMSE", "老年健康"],
  estimatedMinutes: 10,
  interactionMode: "manual_only",
  supportedLanguages: ["zh"],
  requiresConfirmation: false,
  questions: [
    { id: 1, text: "【定向力】现在是哪一年？", clinical_intent: "评估时间定向力（年份）", colloquial: "老人家，请问今年是哪一年？", fallback_examples: ["现在是二零几几年？"], options: createMMSEOptions() },
    { id: 2, text: "【定向力】现在是什么季节？", clinical_intent: "评估时间定向力（季节）", colloquial: "现在是什么季节？", fallback_examples: ["现在是春夏秋冬里的哪一个？"], options: createMMSEOptions() },
    { id: 3, text: "【定向力】现在是几月份？", clinical_intent: "评估时间定向力（月份）", colloquial: "现在是几月份了？", fallback_examples: ["公历或者农历说对一个都行。"], options: createMMSEOptions() },
    { id: 4, text: "【定向力】今天是几号？", clinical_intent: "评估时间定向力（日期）", colloquial: "今天是几号？", fallback_examples: ["今天是这个月的多少号？"], options: createMMSEOptions() },
    { id: 5, text: "【定向力】今天是星期几？", clinical_intent: "评估时间定向力（星期）", colloquial: "今天是星期几呀？", fallback_examples: ["今天是周几？"], options: createMMSEOptions() },
    { id: 6, text: "【定向力】这是什么城市？", clinical_intent: "评估地点定向力（城市）", colloquial: "我们现在是在哪个城市？", fallback_examples: ["这里是哪座市或者哪个县？"], options: createMMSEOptions() },
    { id: 7, text: "【定向力】这是什么区？", clinical_intent: "评估地点定向力（城区/方位）", colloquial: "我们现在是在哪个区？", fallback_examples: ["如果患者是外地人，也可以问家在当地哪个区或方位。"], options: createMMSEOptions() },
    { id: 8, text: "【定向力】这是什么街道？", clinical_intent: "评估地点定向力（街道/具体位置）", colloquial: "我们现在所在的这条街叫什么名字？", fallback_examples: ["外地患者可以问家在哪个街道或者村镇。"], options: createMMSEOptions() },
    { id: 9, text: "【定向力】这是第几层楼？", clinical_intent: "评估地点定向力（楼层）", colloquial: "您知道我们现在是在这栋楼的第几层吗？", fallback_examples: ["这里是几楼？"], options: createMMSEOptions() },
    { id: 10, text: "【定向力】这是什么地方？", clinical_intent: "评估地点定向力（机构/建筑名）", colloquial: "我们现在所在的这个地方是哪里？", fallback_examples: ["比如这里是医院、诊所还是养老机构？"], options: createMMSEOptions() },
    { id: 11, text: "【即刻记忆】我现在告诉您三种东西的名称，我说完后请您重复一遍。第一种是：皮球。", clinical_intent: "评估瞬时记忆力（词语1）", colloquial: "请跟着我说出并记住这三个词：皮球、国旗、树木。（本项记录是否准确复述“皮球”）", fallback_examples: ["患者准确复述出“皮球”即算对。"], options: createMMSEOptions() },
    { id: 12, text: "【即刻记忆】三种东西的第二种：国旗。", clinical_intent: "评估瞬时记忆力（词语2）", colloquial: "（本项记录患者是否准确复述出“国旗”）", fallback_examples: ["顺序不要求，说出“国旗”即算对。"], options: createMMSEOptions() },
    { id: 13, text: "【即刻记忆】三种东西的第三种：树木。", clinical_intent: "评估瞬时记忆力（词语3）", colloquial: "（本项记录患者是否准确复述出“树木”）", fallback_examples: ["顺序不要求，说出“树木”即算对。"], options: createMMSEOptions() },
    { id: 14, text: "【注意力和计算力】算一算，100减去7等于多少？", clinical_intent: "评估工作记忆与计算力（第1次减法）", colloquial: "现在请您算一算，从100里面减去7等于多少？", fallback_examples: ["如果回答93则正确。"], options: createMMSEOptions() },
    { id: 15, text: "【注意力和计算力】再减去7等于多少？ (93 - 7)", clinical_intent: "评估工作记忆与计算力（第2次减法）", colloquial: "请拿刚才算出来的结果再减去7，等于多少？", fallback_examples: ["如果前面减错，按减错的数继续减，只要本步相对过程正确也记分。"], options: createMMSEOptions() },
    { id: 16, text: "【注意力和计算力】再减去7等于多少？ (86 - 7)", clinical_intent: "评估工作记忆与计算力（第3次减法）", colloquial: "再接着往下减去7呢？", fallback_examples: ["标准答案应为79。"], options: createMMSEOptions() },
    { id: 17, text: "【注意力和计算力】再减去7等于多少？ (79 - 7)", clinical_intent: "评估工作记忆与计算力（第4次减法）", colloquial: "再减7等于多少？", fallback_examples: ["标准答案应为72。"], options: createMMSEOptions() },
    { id: 18, text: "【注意力和计算力】最后再减去7等于多少？ (72 - 7)", clinical_intent: "评估工作记忆与计算力（第5次减法）", colloquial: "最后再减一次7，等于多少？", fallback_examples: ["标准答案应为65。"], options: createMMSEOptions() },
    { id: 19, text: "【延迟回忆】请说出刚才我让您记住的三种东西是什么？（是否回忆出“皮球”）", clinical_intent: "评估短时延迟回忆（词语1）", colloquial: "您还记得刚才那三样东西吗？（本项看是否说出“皮球”）", fallback_examples: ["顺序不限，能自己想起来就算对。"], options: createMMSEOptions() },
    { id: 20, text: "【延迟回忆】是否回忆出“国旗”？", clinical_intent: "评估短时延迟回忆（词语2）", colloquial: "（本项看患者的回忆中是否包含“国旗”）", fallback_examples: ["想不起来也不要提示。"], options: createMMSEOptions() },
    { id: 21, text: "【延迟回忆】是否回忆出“树木”？", clinical_intent: "评估短时延迟回忆（词语3）", colloquial: "（本项看患者的回忆中是否包含“树木”）", fallback_examples: ["想不起来也不要提示。"], options: createMMSEOptions() },
    { id: 22, text: "【命名】（出示手表）请问这是什么？", clinical_intent: "评估物品命名能力（手表）", colloquial: "（拿出一块手表）您看这个东西叫什么名字？", fallback_examples: ["回答“手表”或“表”都算对。"], options: createMMSEOptions() },
    { id: 23, text: "【命名】（出示铅笔）请问这是什么？", clinical_intent: "评估物品命名能力（铅笔）", colloquial: "（拿出一支铅笔）那这个东西叫什么？", fallback_examples: ["回答“铅笔”或“笔”都算对。"], options: createMMSEOptions() },
    { id: 24, text: "【复述】请您跟我说：“大家齐心协力拉紧绳”", clinical_intent: "评估语言复述能力", colloquial: "请仔细听，然后把我说的这句话一字不差地重复一遍：“大家齐心协力拉紧绳”。", fallback_examples: ["必须完全相同才算正确，漏字或错字计0分。"], options: createMMSEOptions() },
    { id: 25, text: "【阅读理解】请您念一念这句话，并按这句话的意思去做：“请闭上您的眼睛”。", clinical_intent: "评估阅读与执行能力", colloquial: "（出示写有“请闭上您的眼睛”的纸条）请您念一下纸上的字，然后照着上面写的做。", fallback_examples: ["患者必须有闭眼动作才得分；如患者文盲，该项直接评为0分。"], imageUrl: "/scales/mmse/close-eyes-card.png", imageAlt: "MMSE 阅读理解题原版卡片：请闭上您的眼睛", options: createMMSEOptions() },
    { id: 26, text: "【听觉理解与执行】第一步：患者右手拿起纸。", clinical_intent: "评估分步指令执行能力（第一步）", colloquial: "我给您一张纸，请您按我说的去做：“用您的右手拿起这张纸，把它对折一下，然后放在您的左腿上”。（本项观察是否用右手拿纸）", fallback_examples: ["必须是右手拿起才得分。"], options: createMMSEOptions() },
    { id: 27, text: "【听觉理解与执行】第二步：患者将纸对折。", clinical_intent: "评估分步指令执行能力（第二步）", colloquial: "（本项观察患者是否在拿纸后将其对折）", fallback_examples: ["完成折叠动作即得分。"], options: createMMSEOptions() },
    { id: 28, text: "【听觉理解与执行】第三步：患者将纸放在左腿上。", clinical_intent: "评估分步指令执行能力（第三步）", colloquial: "（本项观察患者是否最终将纸放在了左腿上）", fallback_examples: ["必须放在左腿上才得分。"], options: createMMSEOptions() },
    { id: 29, text: "【书写表达】请您在这张纸上写一个完整的句子。", clinical_intent: "评估语言书写与句法能力", colloquial: "请您拿起笔，在这张纸上随便写一句完整的话。", fallback_examples: ["句子必须有主语、谓语并能表达完整意思；如患者文盲，该项直接评为0分。"], options: createMMSEOptions() },
    { id: 30, text: "【视空间与绘图】请您照着这个样子把它画下来。（出示双五边形交叉图）", clinical_intent: "评估视觉空间结构能力", colloquial: "（出示两个相交五边形的图）请您在这张纸上照着这个图案画一个出来。", fallback_examples: ["画出的图案需有10个角，并且有2条相交直线形成交叉结构才算正确。"], imageUrl: "/scales/mmse/interlocking-pentagons.png", imageAlt: "MMSE 视空间题原版交错五边形图", options: createMMSEOptions() },
  ],
  calculateScore: (answers: number[]): ScaleScoreResult => {
    const safeAnswers =
      answers.length === 30
        ? answers
        : [...answers.slice(0, 30), ...Array(Math.max(0, 30 - answers.length)).fill(0)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let riskLevel: "normal" | "sensitive" | "high" = "normal";
    let conclusion = "";

    if (totalScore <= 17) {
      riskLevel = "high";
      conclusion = "存在显著的认知功能缺陷";
    } else if (totalScore <= 24) {
      riskLevel = "sensitive";
      conclusion = "临界/轻度认知缺陷区间（需结合教育程度判断）";
    } else {
      riskLevel = "normal";
      conclusion = "认知功能评估正常";
    }

    return {
      totalScore,
      conclusion,
      details: {
        riskLevel,
        description: `该量表总分范围为 0-30 分。当前得分为 ${totalScore} 分。\n\nMMSE 的分界值必须结合受教育程度判断：文盲≤17 分、小学≤20 分、中学及以上≤24 分提示可能存在认知缺陷。当前结果仅提供通用风险提示，最终临床解释请结合受教育程度。`,
        TODO_PDF_CHECK:
          "MMSE 高度依赖现场互动与物理道具。当前实现仅适用于评估员面对面代填，且学历分界线仍需结合患者教育程度做最终解释。",
      },
    };
  },
};
