import type {
  ExecutableScaleDefinition,
  ScaleOption,
  ScaleQuestion,
  ScaleScoreResult,
} from "../core/types";

const createForwardOptions = (): ScaleOption[] => [
  { label: "很不符合", score: 1, aliases: ["一点也不符合", "完全不是", "极度不认同", "绝对不是"] },
  { label: "不符合", score: 2, aliases: ["不太符合", "不是", "不认同", "较少符合"] },
  { label: "符合", score: 3, aliases: ["基本符合", "是的", "比较符合", "认同"] },
  { label: "非常符合", score: 4, aliases: ["完全符合", "非常对", "极度认同", "肯定是"] },
];

const createReverseOptions = (): ScaleOption[] => [
  { label: "很不符合", score: 4, aliases: ["一点也不符合", "完全不是", "极度不认同", "绝对不是"] },
  { label: "不符合", score: 3, aliases: ["不太符合", "不是", "不认同", "较少符合"] },
  { label: "符合", score: 2, aliases: ["基本符合", "是的", "比较符合", "认同"] },
  { label: "非常符合", score: 1, aliases: ["完全符合", "非常对", "极度认同", "肯定是"] },
];

const RSES_QUESTIONS: ScaleQuestion[] = [
  { id: 1, text: { zh: "我感到我是一个有价值的人，至少与其他人在同一水平上。", en: "On the whole, I am satisfied with myself." }, clinical_intent: "评估自我价值感的基线", colloquial: "你觉得自己是一个有价值的人吗？至少不比周围的其他人差？", fallback_examples: ["你觉得自己和普通人一样，是个有价值、有用的人吗？"], options: createForwardOptions() },
  { id: 2, text: { zh: "我感到我有许多好的品质。", en: "I feel that I have a number of good qualities." }, clinical_intent: "评估积极自我特质认知", colloquial: "你觉得自己身上有很多优秀的品质吗？", fallback_examples: ["你平时能看到自己性格或能力上的闪光点吗？"], options: createForwardOptions() },
  { id: 3, text: { zh: "归根结底，我倾向于觉得自己是一个失败者。", en: "At times I think I am no good at all." }, clinical_intent: "评估核心失败感（反向计分）", colloquial: "从骨子里来说，你会不会常常觉得自己是个失败者？", fallback_examples: ["遇到事情的时候，会不会总觉得自己注定会失败，是个很失败的人？"], options: createReverseOptions() },
  { id: 4, text: { zh: "我能像大多数人一样把事情做好。", en: "I am able to do things as well as most other people." }, clinical_intent: "评估一般自我效能感", colloquial: "你觉得自己能像大多数普通人那样，把手头上的事情做好吗？", fallback_examples: ["面对日常任务时，你觉得自己有能力像别人一样搞定它们吗？"], options: createForwardOptions() },
  { id: 5, text: { zh: "我感到自己值得自豪的地方不多。", en: "I feel I do not have much to be proud of." }, clinical_intent: "评估自我欣赏缺失程度（反向计分）", colloquial: "你是不是觉得，自己身上没几样拿得出手、值得骄傲的东西？", fallback_examples: ["是不是常常觉得没什么可以让自己感到自豪的？"], options: createReverseOptions() },
  { id: 6, text: { zh: "我对自己持肯定的态度。", en: "I take a positive attitude toward myself." }, clinical_intent: "评估整体自我接纳度", colloquial: "总体来说，你对自己是持肯定、积极态度的吗？", fallback_examples: ["你看待自己的时候，更多是赞许和认可吗？"], options: createForwardOptions() },
  { id: 7, text: { zh: "总的来说，我对自己是满意的。", en: "On the whole, I am satisfied with myself." }, clinical_intent: "评估整体自我满意度", colloquial: "总的来说，你对自己现在的状态和整个人满意吗？", fallback_examples: ["抛开小缺点，大体上你喜欢现在的自己吗？"], options: createForwardOptions() },
  { id: 8, text: { zh: "我希望能为自己赢得更多尊重。", en: "I wish I could have more respect for myself." }, clinical_intent: "评估自我提升愿望与进取心（本版采用正向计分）", colloquial: "你是不是希望自己能变得更好，从而赢得别人更多的尊重？", fallback_examples: ["你内心深处渴望别人能更尊重你、看得起你吗？"], options: createForwardOptions() },
  { id: 9, text: { zh: "我确实时常感到自己毫无用处。", en: "I certainly feel useless at times." }, clinical_intent: "评估自我无用感（反向计分）", colloquial: "你会不会经常有一种感觉，觉得自己一点用都没有？", fallback_examples: ["遇到挫折时，会不会觉得自己像个废人，什么忙都帮不上？"], options: createReverseOptions() },
  { id: 10, text: { zh: "我时常认为自己一无是处。", en: "At times I think I am no good at all." }, clinical_intent: "评估极端自我贬低（反向计分）", colloquial: "你会不会时不时地认为自己一无是处，浑身都是缺点？", fallback_examples: ["是不是偶尔会冒出‘我这个人简直糟透了’这样的想法？"], options: createReverseOptions() },
];

export const RSES_Scale: ExecutableScaleDefinition = {
  id: "RSES_10",
  version: "1.0",
  title: {
    zh: "Rosenberg 自尊量表 (RSES)",
    en: "Rosenberg Self-Esteem Scale (RSES)",
  },
  description: {
    zh: "RSES 由美国社会学家 Morris Rosenberg 于 1965 年编制，是国际上应用最广泛的自尊评估工具之一，用于测量个体对自我价值和自我接纳的总体感受。",
    en: "The RSES is a widely used self-report instrument for evaluating individual self-esteem.",
  },
  category: "Personality",
  source: "builtin",
  tags: ["自尊", "自我认知", "人格测评", "RSES"],
  estimatedMinutes: 3,
  interactionMode: "voice_guided",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: false,
  questions: RSES_QUESTIONS,
  calculateScore: (answers: number[]): ScaleScoreResult => {
    const safeAnswers =
      answers.length === 10
        ? answers
        : [...answers.slice(0, 10), ...Array(Math.max(0, 10 - answers.length)).fill(1)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let riskLevel: "normal" | "sensitive" | "high" = "normal";
    let conclusion = "";

    if (totalScore < 25) {
      riskLevel = "sensitive";
      conclusion = "低自尊水平";
    } else if (totalScore <= 35) {
      riskLevel = "normal";
      conclusion = "正常/中等自尊水平";
    } else {
      riskLevel = "normal";
      conclusion = "高自尊水平";
    }

    return {
      totalScore,
      conclusion,
      details: {
        riskLevel,
        description: `您的自尊量表得分为 ${totalScore} 分（总分范围 10-40 分）。得分越高，通常说明自尊水平与自我接纳程度越高。一般认为，低于 25 分提示需要更多关注和接纳自我；25-35 分为大多数人的常见范围；35 分以上说明您有较充分的自我认同。`,
        TODO_PDF_CHECK:
          "第 8 题在部分海外原版研究中常按反向题处理，但当前实现遵循你提供的国内适配说明，按正向计分。",
      },
    };
  },
};
