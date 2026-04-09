import snapIvContent from "@/data/scale-content/snap-iv.content.json";

import type { ExecutableScaleDefinition, ScaleOption, ScaleQuestion } from "../core/types";

type SnapIvContentOption = {
  label: string;
  description?: string;
  aliases?: string[];
};

type SnapIvContentQuestion = {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  options: SnapIvContentOption[];
  notes?: string;
};

type SnapIvContentFile = {
  version?: string;
  questions: SnapIvContentQuestion[];
};

const SNAP_IV_OPTION_SCORES = [0, 1, 2, 3];

function buildSnapIvOptionScore(optionIndex: number) {
  return SNAP_IV_OPTION_SCORES[optionIndex];
}

function assertSnapIvContentShape(content: SnapIvContentFile): asserts content is SnapIvContentFile {
  if (!Array.isArray(content.questions) || content.questions.length !== 26) {
    throw new Error(`SNAP-IV content must contain exactly 26 questions, received ${content.questions?.length ?? 0}`);
  }

  const ids = new Set<number>();
  content.questions.forEach((question, index) => {
    if (typeof question.id !== "number") {
      throw new Error(`SNAP-IV content question at index ${index} is missing a numeric id`);
    }
    if (question.id !== index + 1) {
      throw new Error(
        `SNAP-IV content question ids must be continuous from 1 to 26. Expected ${index + 1}, received ${question.id}`
      );
    }
    if (ids.has(question.id)) {
      throw new Error(`SNAP-IV content has duplicated question id: ${question.id}`);
    }
    ids.add(question.id);

    if (!question.text?.trim()) {
      throw new Error(`SNAP-IV question ${question.id} is missing text`);
    }
    if (!question.clinical_intent?.trim()) {
      throw new Error(`SNAP-IV question ${question.id} is missing clinical_intent`);
    }
    if (!question.colloquial?.trim()) {
      throw new Error(`SNAP-IV question ${question.id} is missing colloquial`);
    }
    if (!Array.isArray(question.fallback_examples)) {
      throw new Error(`SNAP-IV question ${question.id} fallback_examples must be an array`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`SNAP-IV question ${question.id} must define exactly 4 options`);
    }

    question.options.forEach((option, optionIndex) => {
      if (!option.label?.trim()) {
        throw new Error(`SNAP-IV question ${question.id} option ${optionIndex + 1} is missing label`);
      }
      if (option.aliases !== undefined && !Array.isArray(option.aliases)) {
        throw new Error(`SNAP-IV question ${question.id} option ${optionIndex + 1} aliases must be an array`);
      }
    });
  });
}

function buildSnapIvQuestions(content: SnapIvContentFile): ScaleQuestion[] {
  assertSnapIvContentShape(content);

  return content.questions.map((question) => ({
    id: question.id,
    text: question.text,
    clinical_intent: question.clinical_intent,
    colloquial: question.colloquial,
    fallback_examples: question.fallback_examples,
    options: question.options.map((option, index): ScaleOption => ({
      label: option.label,
      description: option.description,
      aliases: option.aliases,
      score: buildSnapIvOptionScore(index),
    })),
  }));
}

const SNAP_QUESTIONS: ScaleQuestion[] = buildSnapIvQuestions(snapIvContent as SnapIvContentFile);

export const SNAP_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "SNAP-IV",
  version: "1.0",
  title: {
    zh: "注意缺陷多动障碍筛查量表 (SNAP-IV-26)",
    en: "SNAP-IV ADHD Rating Scale",
  },
  description: {
    zh: "用于评估儿童及青少年注意力缺陷、多动/冲动以及对立违抗行为的严重程度。分为三个独立维度计分。",
    en: "A scale for assessing attention deficit, hyperactivity/impulsivity, and oppositional symptoms.",
  },
  category: "Child Development",
  tags: ["儿童发育", "ADHD", "多动", "注意力"],
  interactionMode: "voice_guided",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: true,
  questions: SNAP_QUESTIONS,

  calculateScore: (answers: number[]) => {
    const safeAnswers = answers.length === 26 ? answers : [...answers, ...Array(26 - answers.length).fill(0)];

    const inattentionScore = safeAnswers.slice(0, 9).reduce((sum, s) => sum + s, 0);
    const hyperactivityScore = safeAnswers.slice(9, 18).reduce((sum, s) => sum + s, 0);
    const oddScore = safeAnswers.slice(18, 26).reduce((sum, s) => sum + s, 0);

    const totalScore = inattentionScore + hyperactivityScore + oddScore;

    let conclusion: string;
    let detailsStr = `【注意力得分】: ${inattentionScore}/27 (≥13分提示异常)\n【多动冲动得分】: ${hyperactivityScore}/27 (≥13分提示异常)\n【对立违抗得分】: ${oddScore}/24 (≥8分提示异常)\n\n`;

    if (inattentionScore >= 13 || hyperactivityScore >= 13 || oddScore >= 8) {
      conclusion = "疑似存在明显 ADHD 症状";
      detailsStr += "临床建议：发现存在核心维度的显著偏高，强烈建议寻求儿童精神科或发育行为科专业医师进行全面评估与干预。";
    } else if (totalScore >= 20) {
      conclusion = "临界/轻微症状";
      detailsStr += "临床建议：存在部分注意力不集中、多动或违抗表现，建议结合儿童日常表现持续观察，尝试调整教养方式，必要时咨询专业人士。";
    } else {
      conclusion = "正常范围";
      detailsStr += "临床建议：目前评估结果在正常范围内，未见明显的注意力缺陷、多动或对立违抗核心症状。";
    }

    return {
      totalScore,
      conclusion,
      details: {
        dimensions: {
          inattention: inattentionScore,
          hyperactivity: hyperactivityScore,
          oppositionalDefiant: oddScore,
        },
        description: detailsStr,
      },
    };
  },
};
