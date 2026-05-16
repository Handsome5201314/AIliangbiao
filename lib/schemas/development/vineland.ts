import fs from "node:fs";
import path from "node:path";

import type { ExecutableScaleDefinition, ScaleQuestion } from "../core/types";

type VinelandOptionSetKey = "adaptive" | "maladaptive";

type VinelandItemAsset = {
  id: number;
  text: string;
  sectionKey: string;
  sectionLabel: string;
  sectionNumber: number;
  subsectionKey?: string;
  subsectionLabel?: string;
  localQuestionNumber: number;
  ageBandLabel: string;
  domainKey: string;
  optionSetKey: VinelandOptionSetKey;
  supportsEstimate: boolean;
};

type SectionScoreSummary = {
  label: string;
  score: number;
  maxScore: number;
  questionCount: number;
};

function loadVinelandItems(): VinelandItemAsset[] {
  const assetPath = path.join(process.cwd(), "data", "scale-assets", "vineland-3.items.json");
  const raw = fs.readFileSync(assetPath, "utf8");
  return JSON.parse(raw) as VinelandItemAsset[];
}

const VINELAND_ITEMS = loadVinelandItems();

const ADAPTIVE_OPTIONS = [
  {
    label: "总是如此",
    score: 2,
    description: "经常完成而不需要帮助或提醒，或已经稳定掌握该技能。",
  },
  {
    label: "有时如此",
    score: 1,
    description: "有时可以完成该行为，但表现还不稳定。",
  },
  {
    label: "从不",
    score: 0,
    description: "从不表现出该行为，或需要明显帮助与提醒。",
  },
];

const MALADAPTIVE_OPTIONS = [
  {
    label: "总是/严重",
    score: 2,
    description: "经常出现，或严重影响日常功能。",
  },
  {
    label: "偶尔/轻度",
    score: 1,
    description: "偶尔出现，或程度较轻。",
  },
  {
    label: "从不",
    score: 0,
    description: "没有观察到这类问题行为。",
  },
];

const SECTION_ORDER = [
  "listening_and_understanding",
  "talking",
  "reading_and_writing",
  "caring_for_self",
  "caring_for_home",
  "living_in_the_community",
  "relating_to_others",
  "playing_and_using_leisure_time",
  "adapting",
  "using_large_muscles",
  "using_small_muscles",
  "problem_behaviors.section_a",
  "problem_behaviors.section_b",
  "problem_behaviors.section_c",
] as const;

function getQuestionOptions(optionSetKey: VinelandOptionSetKey) {
  return optionSetKey === "maladaptive" ? MALADAPTIVE_OPTIONS : ADAPTIVE_OPTIONS;
}

function buildClinicalIntent(item: VinelandItemAsset) {
  const label = item.subsectionLabel || item.sectionLabel || item.sectionKey;
  return `评估 Vineland-3「${label}」中的适应行为表现。`;
}

function toQuestion(item: VinelandItemAsset): ScaleQuestion {
  return {
    id: item.id,
    text: item.text,
    clinical_intent: buildClinicalIntent(item),
    colloquial: item.text,
    fallback_examples: [item.text],
    options: getQuestionOptions(item.optionSetKey),
    sectionKey: item.sectionKey,
    sectionLabel: item.sectionLabel,
    subsectionKey: item.subsectionKey,
    subsectionLabel: item.subsectionLabel,
    ageBandLabel: item.ageBandLabel,
    supportsEstimate: item.supportsEstimate,
    domainKey: item.domainKey,
    localQuestionNumber: item.localQuestionNumber,
    riskLevel: item.optionSetKey === "maladaptive" ? "sensitive" : "normal",
  };
}

const VINELAND_QUESTIONS = VINELAND_ITEMS.map(toQuestion);

function buildSectionScoreSummaries(answers: number[]) {
  const bySection = new Map<string, SectionScoreSummary>();

  VINELAND_QUESTIONS.forEach((question, index) => {
    const sectionKey =
      question.sectionKey === "problem_behaviors" && question.subsectionKey
        ? `${question.sectionKey}.${question.subsectionKey}`
        : question.sectionKey || `question_${question.id}`;
    const label = question.subsectionLabel
      ? `${String(question.sectionLabel)} · ${String(question.subsectionLabel)}`
      : String(question.sectionLabel || sectionKey);
    const score = answers[index] ?? 0;
    const maxScore = Math.max(...question.options.map((option) => option.score));
    const existing = bySection.get(sectionKey);

    if (!existing) {
      bySection.set(sectionKey, {
        label,
        score,
        maxScore,
        questionCount: 1,
      });
      return;
    }

    existing.score += score;
    existing.maxScore += maxScore;
    existing.questionCount += 1;
  });

  return Object.fromEntries(
    SECTION_ORDER.map((sectionKey) => {
      const summary = bySection.get(sectionKey);
      return [
        sectionKey,
        summary || {
          label: sectionKey,
          score: 0,
          maxScore: 0,
          questionCount: 0,
        },
      ];
    })
  );
}

function buildDomainSummaries(answers: number[]) {
  const totals = {
    communication: { label: "沟通领域", score: 0, maxScore: 0 },
    dailyLiving: { label: "日常生活领域", score: 0, maxScore: 0 },
    socialization: { label: "社会化领域", score: 0, maxScore: 0 },
    motor: { label: "运动技能领域", score: 0, maxScore: 0 },
    maladaptive: { label: "问题行为总分", score: 0, maxScore: 0 },
  };

  VINELAND_QUESTIONS.forEach((question, index) => {
    const score = answers[index] ?? 0;
    const maxScore = Math.max(...question.options.map((option) => option.score));

    switch (question.domainKey) {
      case "communication":
        totals.communication.score += score;
        totals.communication.maxScore += maxScore;
        break;
      case "daily_living":
        totals.dailyLiving.score += score;
        totals.dailyLiving.maxScore += maxScore;
        break;
      case "socialization":
        totals.socialization.score += score;
        totals.socialization.maxScore += maxScore;
        break;
      case "motor":
        totals.motor.score += score;
        totals.motor.maxScore += maxScore;
        break;
      case "maladaptive_internal":
      case "maladaptive_external":
      case "maladaptive_critical":
        totals.maladaptive.score += score;
        totals.maladaptive.maxScore += maxScore;
        break;
      default:
        break;
    }
  });

  return totals;
}

function findFirstStreak(scores: number[], target: number, streakLength = 5) {
  let streak = 0;
  for (let index = 0; index < scores.length; index += 1) {
    streak = scores[index] === target ? streak + 1 : 0;
    if (streak >= streakLength) {
      return {
        achieved: true,
        from: index - streakLength + 2,
        to: index + 1,
      };
    }
  }

  return { achieved: false as const };
}

function buildBasalCeiling(answers: number[]) {
  const adaptiveSectionKeys = [
    "listening_and_understanding",
    "talking",
    "reading_and_writing",
    "caring_for_self",
    "caring_for_home",
    "living_in_the_community",
    "relating_to_others",
    "playing_and_using_leisure_time",
    "adapting",
    "using_large_muscles",
    "using_small_muscles",
  ];

  return Object.fromEntries(
    adaptiveSectionKeys.map((sectionKey) => {
      const questions = VINELAND_QUESTIONS.filter((question) => question.sectionKey === sectionKey);
      const scores = questions.map((question) => {
        const index = VINELAND_QUESTIONS.findIndex((candidate) => candidate.id === question.id);
        return answers[index] ?? 0;
      });

      return [
        sectionKey,
        {
          label: String(questions[0]?.sectionLabel || sectionKey),
          basal: findFirstStreak(scores, 2),
          ceiling: findFirstStreak(scores, 0),
        },
      ];
    })
  );
}

export const Vineland3_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "VINELAND_3",
  version: "3.0-cn-phase1",
  title: {
    zh: "文莱适应行为量表（Vineland-3 中文编译版）",
    en: "Vineland Adaptive Behavior Scales, Third Edition (Chinese Build)",
  },
  description: {
    zh: "面向儿童发育与适应行为评估的超长量表，覆盖沟通、日常生活、社会化、运动与问题行为。当前阶段提供全量采集、原始分汇总与医生复核链路。",
    en: "A long-form adaptive behavior assessment with grouped handoff collection, raw-score aggregation, and physician review workflow.",
  },
  category: "Child Development",
  tags: ["Vineland-3", "适应行为", "综合发育", "web_handoff", "医生复核"],
  estimatedMinutes: 45,
  interactionMode: "web_handoff",
  supportedLanguages: ["zh"],
  requiresConfirmation: false,
  resultDeliveryMode: "physician_review",
  questions: VINELAND_QUESTIONS,
  calculateScore(answers: number[]) {
    const safeAnswers = VINELAND_QUESTIONS.map((question, index) => {
      const score = answers[index];
      return typeof score === "number" && question.options.some((option) => option.score === score)
        ? score
        : 0;
    });

    const dimensions = buildDomainSummaries(safeAnswers);
    const sections = buildSectionScoreSummaries(safeAnswers);
    const basalCeiling = buildBasalCeiling(safeAnswers);
    const adaptiveTotal =
      dimensions.communication.score +
      dimensions.dailyLiving.score +
      dimensions.socialization.score +
      dimensions.motor.score;

    return {
      totalScore: adaptiveTotal,
      conclusion: "Vineland-3 原始分已生成，需结合常模与临床背景由医生复核。",
      details: {
        scoreLabel: "适应性原始总分",
        scoreDisplay: `${adaptiveTotal} / ${
          dimensions.communication.maxScore +
          dimensions.dailyLiving.maxScore +
          dimensions.socialization.maxScore +
          dimensions.motor.maxScore
        }`,
        totalScoreLabel: "适应性原始总分",
        totalScoreHint: "当前阶段未启用标准分、v-Scale、域标准分与复合分换算。",
        dimensions: {
          communication: dimensions.communication,
          dailyLiving: dimensions.dailyLiving,
          socialization: dimensions.socialization,
          motor: dimensions.motor,
          maladaptive: dimensions.maladaptive,
        },
        sections,
        basalCeiling,
        description: [
          "Vineland-3 已完成原始分汇总。",
          `沟通领域原始分：${dimensions.communication.score}/${dimensions.communication.maxScore}`,
          `日常生活领域原始分：${dimensions.dailyLiving.score}/${dimensions.dailyLiving.maxScore}`,
          `社会化领域原始分：${dimensions.socialization.score}/${dimensions.socialization.maxScore}`,
          `运动技能原始分：${dimensions.motor.score}/${dimensions.motor.maxScore}`,
          `问题行为原始分：${dimensions.maladaptive.score}/${dimensions.maladaptive.maxScore}`,
          `适应性原始总分：${adaptiveTotal}`,
          "当前版本未内置常模换算表，标准分与复合分报告将在补齐手册/常模后开放。",
          "Basal / ceiling 标注基于全量作答后的连续得分观察结果，仅作医生复核辅助，不在家长端强制跳题。",
        ].join("\n"),
      },
    };
  },
};
