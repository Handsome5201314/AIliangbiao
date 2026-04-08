import type { ExecutableScaleDefinition, ScaleQuestion } from "../core/types";

type HollandCode = "R" | "I" | "A" | "S" | "E" | "C";

const HOLLAND_DIMENSION_LABELS: Record<HollandCode, string> = {
  R: "实际型",
  I: "研究型",
  A: "艺术型",
  S: "社会型",
  E: "事业型",
  C: "常规型",
};

const YES_NO_OPTIONS = [
  { label: "是", score: 1, aliases: ["是", "喜欢", "愿意", "能"] },
  { label: "否", score: 0, aliases: ["否", "不喜欢", "不愿意", "不能"] },
];

const SELF_RATING_OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  label: `${index + 1}`,
  score: index + 1,
}));

const HOLLAND_DESCRIPTIONS: Record<HollandCode, string> = {
  R: "偏好动手操作、机械维修、户外任务和具体事务，适合实践导向与落地执行场景。",
  I: "偏好分析、研究、实验和抽象思考，适合科学探索、数据推理和知识工作。",
  A: "偏好创作、表达、审美与想象，适合艺术、内容、设计与创意岗位。",
  S: "偏好帮助他人、教育辅导、沟通支持与照护工作，适合服务导向型角色。",
  E: "偏好影响他人、说服、领导与商业推进，适合管理、销售、运营和拓展岗位。",
  C: "偏好规则、秩序、流程和细节，适合财务、行政、数据、运营支持类工作。",
};

const HOLLAND_CAREER_SUGGESTIONS: Record<HollandCode, string[]> = {
  R: ["木匠", "工程师", "飞机机械师", "电工", "机械制图员"],
  I: ["气象学者", "生物学者", "化学家", "数学家", "科研人员"],
  A: ["摄影师", "作家", "演员", "作曲家", "编剧"],
  S: ["导游", "心理咨询员", "教师", "社会工作者", "公共保健护士"],
  E: ["销售员", "广告宣传员", "旅馆经理", "律师", "企业管理咨询人员"],
  C: ["会计", "银行出纳", "税务员", "统计员", "计算机操作员"],
};

const PART_TWO_INTERESTS: Record<HollandCode, string[]> = {
  R: ["装配修理电器或玩具", "修理自行车", "用木头做东西", "开汽车或摩托车", "用机器做东西", "参加木工技术学习班", "参加制图描图学习班", "驾驶卡车或拖拉机", "参加机械和电气学习班", "装配修理机器"],
  A: ["素描制图或绘画", "参加话剧或戏剧活动", "设计家具布置室内", "练习乐器或参加乐队", "欣赏音乐或戏剧", "看小说或读剧本", "从事摄影创作", "写诗或吟诗", "参加艺术（美术/音乐）培训", "练习书法"],
  I: ["读科技图书和杂志", "在实验室工作", "改良水果品种，培育新的水果", "调查了解土和金属等物质的成分", "研究自己选择的特殊问题", "解算术或玩数学游戏", "学习物理", "学习化学", "学习几何", "学习生物"],
  S: ["参加学校或单位组织的正式活动", "参加社会团体或俱乐部活动", "帮助别人解决困难", "照顾儿童", "出席晚会、联欢会或茶话会", "和大家一起出去郊游", "想获得心理方面的知识", "参加讲座会或辩论会", "观看或参加体育比赛和运动会", "结交新朋友"],
  E: ["说服鼓动他人", "卖东西", "谈论政治", "制定计划或参加会议", "以自己的意志影响别人的行为", "在社会团体中担任职务", "检查与评价别人的工作", "结交名流", "指导有某种目标的团体", "参与政治活动"],
  C: ["整理好桌面和房间", "抄写文件和信件", "为领导写报告或公务信函", "检查个人收支情况", "参加打字培训班", "参加算盘、文秘等实务培训", "参加商业会计培训班", "参加情报处理培训班", "整理信件、报告、记录等", "写商业贸易信"],
};

const PART_THREE_ABILITIES: Record<HollandCode, string[]> = {
  R: ["能使用电锯、电钻和锉刀等木工工具", "知道万用表的使用方法", "能够修理自行车或其他机械", "能够使用电钻床、磨床或缝纫机", "能给家具和木制品刷漆", "能看建筑设计图", "能够修理简单的电气用品", "能修理家具", "能修理收录机", "能简单地修理水管"],
  A: ["能演奏乐器", "能参加二部或四部合唱", "能独唱或独奏", "能扮演剧中角色", "能创作简单的乐曲", "会跳舞", "能绘画、素描或书法", "能雕刻、剪纸或泥塑", "能设计板报、服装或家具", "写得一手好文章"],
  I: ["懂得真空管或晶体管的作用", "能够列举三种蛋白质多的食品", "理解铀的裂变", "能用计算尺、计算器、对数表", "会使用显微镜", "能找到三个星座", "能独立进行调查研究", "能解释简单的化学", "理解人造卫星为什么不落地", "经常参加学术会议"],
  S: ["有向各种人说明解释的能力", "常参加社会福利活动", "能和大家一起友好相处地工作", "善于与年长者相处", "会邀请人、招待人", "能简单易懂地教育儿童", "能安排会议等活动顺序", "善于体察人心和帮助他人", "帮助护理病人和伤员", "安排社团组织的各种事务"],
  E: ["担任过学生干部并且干得不错", "工作上能指导和监督他人", "做事充满活力和热情", "有效利用自身做法调动他人", "销售能力强", "曾作为俱乐部或社团的负责人", "向领导提出建议或反映意见", "有开创事业的能力", "知道怎样做能成为优秀的领导者", "健谈善辩"],
  C: ["会熟练地打印中文", "会用外文打字机或复印机", "能快速记笔记和抄写文章", "善于整理保管文件和资料", "善于从事事务性的工作", "会用算盘", "能在短时间内分类和处理大量文件", "能使用计算机", "能搜集数据", "善于为自己或集体做财务预算表"],
};

const PART_FOUR_OCCUPATIONS: Record<HollandCode, string[]> = {
  R: ["飞机机械师", "野生动物专家", "汽车维修工", "木匠", "测量工程师", "无线电报务员", "园艺师", "长途公共汽车司机", "火车司机", "电工"],
  S: ["街道、工会或妇联干部", "小学或中学教师", "精神科医生", "婚姻介绍所工作人员", "体育教练", "福利机构负责人", "心理咨询员", "共青团干部", "导游", "国家机关工作人员"],
  I: ["气象学或天文学者", "生物学者", "医学实验室技术人员", "人类学者", "动物学者", "化学者", "数学学者", "科学杂志的编辑或作家", "地质学者", "物理学者"],
  E: ["厂长", "电视片编制人", "公司经理", "销售员", "不动产推销员", "广告部长", "体育活动主办者", "销售部长", "个体工商业者", "企业管理咨询人员"],
  A: ["乐队指挥", "演奏家", "作家", "摄影家", "记者", "画家或书法家", "歌唱家", "作曲家", "电影电视演员", "编剧"],
  C: ["会计师", "银行出纳员", "税收管理员", "计算机操作员", "簿记人员", "成本核算员", "文书档案管理员", "打字员", "法庭书记员", "人口普查登记员"],
};

const PART_FIVE_SELF_RATINGS: Array<{ trait: HollandCode; label: string }> = [
  { trait: "R", label: "机械操作能力" },
  { trait: "I", label: "科学研究能力" },
  { trait: "A", label: "艺术创作能力" },
  { trait: "S", label: "解释表达能力" },
  { trait: "E", label: "商业洽谈能力" },
  { trait: "C", label: "事务执行能力" },
  { trait: "R", label: "体育技能" },
  { trait: "I", label: "数学技能" },
  { trait: "A", label: "音乐技能" },
  { trait: "S", label: "交际技能" },
  { trait: "E", label: "领导技能" },
  { trait: "C", label: "办公技能" },
];

const binaryQuestionMeta = new Map<number, HollandCode>();
const ratingQuestionMeta = new Map<number, HollandCode>();

function createBinaryQuestion(id: number, trait: HollandCode, sectionLabel: string, text: string): ScaleQuestion {
  binaryQuestionMeta.set(id, trait);
  return {
    id,
    text: `【${sectionLabel}·${HOLLAND_DIMENSION_LABELS[trait]}】${text}`,
    clinical_intent: `霍兰德 ${trait} 维度`,
    colloquial: `${sectionLabel}中，您是否认可自己“${text}”？`,
    fallback_examples: [],
    options: YES_NO_OPTIONS,
  };
}

function createSelfRatingQuestion(id: number, trait: HollandCode, label: string): ScaleQuestion {
  ratingQuestionMeta.set(id, trait);
  return {
    id,
    text: `【能力自评·${HOLLAND_DIMENSION_LABELS[trait]}】${label}`,
    clinical_intent: `霍兰德 ${trait} 维度自评`,
    colloquial: `请为自己的“${label}”打分，1 分最低，7 分最高。`,
    fallback_examples: [],
    options: SELF_RATING_OPTIONS,
  };
}

function buildHollandQuestions(): ScaleQuestion[] {
  const questions: ScaleQuestion[] = [];
  let id = 1;

  (Object.entries(PART_TWO_INTERESTS) as Array<[HollandCode, string[]]>).forEach(([trait, items]) => {
    items.forEach((item) => questions.push(createBinaryQuestion(id++, trait, "兴趣活动", item)));
  });

  (Object.entries(PART_THREE_ABILITIES) as Array<[HollandCode, string[]]>).forEach(([trait, items]) => {
    items.forEach((item) => questions.push(createBinaryQuestion(id++, trait, "擅长活动", item)));
  });

  (Object.entries(PART_FOUR_OCCUPATIONS) as Array<[HollandCode, string[]]>).forEach(([trait, items]) => {
    items.forEach((item) => questions.push(createBinaryQuestion(id++, trait, "职业偏好", item)));
  });

  PART_FIVE_SELF_RATINGS.forEach((item) => {
    questions.push(createSelfRatingQuestion(id++, item.trait, item.label));
  });

  return questions;
}

const HOLLAND_QUESTIONS = buildHollandQuestions();

function describeTopCode(code: HollandCode): string {
  return `${HOLLAND_DIMENSION_LABELS[code]}：${HOLLAND_DESCRIPTIONS[code]}`;
}

export const HOLLAND_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "HOLLAND",
  version: "1.0",
  title: {
    zh: "霍兰德职业倾向测验量表",
    en: "Holland Vocational Interest Scale",
  },
  description: {
    zh: "基于 RIASEC 六维模型的职业兴趣与能力倾向量表，用于职业探索与专业方向参考。",
    en: "A RIASEC-based vocational interest and ability scale for career exploration.",
  },
  category: "Career Assessment",
  tags: ["职业", "霍兰德", "RIASEC", "职业兴趣", "生涯规划"],
  estimatedMinutes: 20,
  interactionMode: "full_voice",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: false,
  questions: HOLLAND_QUESTIONS,
  calculateScore: (answers: number[]) => {
    const safeAnswers = answers.slice(0, HOLLAND_QUESTIONS.length);
    while (safeAnswers.length < HOLLAND_QUESTIONS.length) {
      safeAnswers.push(0);
    }

    const scores: Record<HollandCode, number> = {
      R: 0,
      I: 0,
      A: 0,
      S: 0,
      E: 0,
      C: 0,
    };

    safeAnswers.forEach((answer, index) => {
      const questionId = index + 1;
      const binaryTrait = binaryQuestionMeta.get(questionId);
      const ratingTrait = ratingQuestionMeta.get(questionId);

      if (binaryTrait) {
        scores[binaryTrait] += answer === 1 ? 1 : 0;
        return;
      }

      if (ratingTrait) {
        scores[ratingTrait] += Math.max(1, Math.min(7, answer));
      }
    });

    const sortedTraits = (Object.entries(scores) as Array<[HollandCode, number]>)
      .sort((a, b) => b[1] - a[1]);
    const topThree = sortedTraits.slice(0, 3).map(([trait]) => trait);
    const topCode = topThree.join("");
    const [primaryTrait, secondaryTrait, tertiaryTrait] = topThree as HollandCode[];
    const highestScore = sortedTraits[0][1];

    const detailsDescription = [
      `【职业兴趣代码】：${topCode}`,
      "",
      "【六维得分】",
      ...sortedTraits.map(([trait, score]) => `${trait}（${HOLLAND_DIMENSION_LABELS[trait]}）：${score}`),
      "",
      "【前三优势维度】",
      describeTopCode(primaryTrait),
      describeTopCode(secondaryTrait),
      describeTopCode(tertiaryTrait),
      "",
      `【职业方向建议】：可优先探索 ${HOLLAND_DIMENSION_LABELS[primaryTrait]} 主导的方向，例如 ${HOLLAND_CAREER_SUGGESTIONS[primaryTrait].join("、")}。`,
      "【说明】：本数字化版本完整覆盖页面中用于统计职业兴趣倾向的核心计分部分（兴趣活动、擅长活动、职业偏好、能力自评）。开放式职业书写与价值排序建议可在结果页作为延伸反思。",
    ].join("\n");

    return {
      totalScore: highestScore,
      conclusion: topCode,
      details: {
        description: detailsDescription,
        scoreLabel: "职业兴趣代码",
        scoreDisplay: topCode,
        totalScoreLabel: "最高维度得分",
        totalScoreHint: "该分数表示六维中得分最高的一项，用于展示主导职业倾向强度。",
        dimensions: scores,
        topDimensions: topThree,
        careerSuggestions: HOLLAND_CAREER_SUGGESTIONS[primaryTrait],
      },
    };
  },
};
