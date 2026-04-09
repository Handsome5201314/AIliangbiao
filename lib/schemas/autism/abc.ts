import abcContent from "@/data/scale-content/abc.content.json";

import type { ExecutableScaleDefinition, ScaleOption, ScaleQuestion } from "../core/types";

type AbcContentOption = {
  label: string;
  description?: string;
  aliases?: string[];
};

type AbcContentQuestion = {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  options: AbcContentOption[];
  notes?: string;
};

type AbcContentFile = {
  version?: string;
  questions: AbcContentQuestion[];
};

const ABC_YES_WEIGHTS: Record<number, number> = {
  1: 4,
  2: 2,
  3: 4,
  4: 2,
  5: 4,
  6: 3,
  7: 4,
  8: 3,
  9: 3,
  10: 3,
  11: 4,
  12: 4,
  13: 2,
  14: 3,
  15: 2,
  16: 4,
  17: 3,
  18: 2,
  19: 4,
  20: 2,
  21: 3,
  22: 4,
  23: 2,
  24: 4,
  25: 4,
  26: 3,
  27: 3,
  28: 2,
  29: 2,
  30: 3,
  31: 2,
  32: 3,
  33: 4,
  34: 3,
  35: 3,
  36: 2,
  37: 2,
  38: 4,
  39: 3,
  40: 3,
  41: 2,
  42: 2,
  43: 3,
  44: 2,
  45: 1,
  46: 4,
  47: 4,
  48: 4,
  49: 2,
  50: 4,
  51: 3,
  52: 3,
  53: 4,
  54: 2,
  55: 1,
  56: 3,
  57: 4,
};

function buildAbcOptionScore(questionId: number, optionIndex: number) {
  return optionIndex === 0 ? 0 : ABC_YES_WEIGHTS[questionId];
}

function assertAbcContentShape(content: AbcContentFile): asserts content is AbcContentFile {
  if (!Array.isArray(content.questions) || content.questions.length !== 57) {
    throw new Error(`ABC content must contain exactly 57 questions, received ${content.questions?.length ?? 0}`);
  }

  const ids = new Set<number>();
  content.questions.forEach((question, index) => {
    if (typeof question.id !== "number") {
      throw new Error(`ABC content question at index ${index} is missing a numeric id`);
    }
    if (question.id !== index + 1) {
      throw new Error(
        `ABC content question ids must be continuous from 1 to 57. Expected ${index + 1}, received ${question.id}`
      );
    }
    if (ids.has(question.id)) {
      throw new Error(`ABC content has duplicated question id: ${question.id}`);
    }
    ids.add(question.id);

    if (!question.text?.trim()) {
      throw new Error(`ABC question ${question.id} is missing text`);
    }
    if (!question.clinical_intent?.trim()) {
      throw new Error(`ABC question ${question.id} is missing clinical_intent`);
    }
    if (!question.colloquial?.trim()) {
      throw new Error(`ABC question ${question.id} is missing colloquial`);
    }
    if (!Array.isArray(question.fallback_examples)) {
      throw new Error(`ABC question ${question.id} fallback_examples must be an array`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 2) {
      throw new Error(`ABC question ${question.id} must define exactly 2 options`);
    }

    question.options.forEach((option, optionIndex) => {
      if (!option.label?.trim()) {
        throw new Error(`ABC question ${question.id} option ${optionIndex + 1} is missing label`);
      }
      if (option.aliases !== undefined && !Array.isArray(option.aliases)) {
        throw new Error(`ABC question ${question.id} option ${optionIndex + 1} aliases must be an array`);
      }
    });

    if (ABC_YES_WEIGHTS[question.id] === undefined) {
      throw new Error(`ABC question ${question.id} is missing a yes-weight mapping`);
    }
  });
}

function buildAbcQuestions(content: AbcContentFile): ScaleQuestion[] {
  assertAbcContentShape(content);

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
      score: buildAbcOptionScore(question.id, index),
    })),
  }));
}

const ABC_QUESTIONS: ScaleQuestion[] = buildAbcQuestions(abcContent as AbcContentFile);

export const ABC_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "ABC",
  version: "1.0",
  title: {
    zh: "孤独症行为评定量表 (ABC)",
    en: "Autism Behavior Checklist (ABC)",
  },
  description: {
    zh: "用于筛查和评估儿童孤独症的严重程度，包含感觉、交往、躯体运动、语言和生活自理五个维度的异常表现。",
    en: "A screening and assessment scale for autism-related behaviors across sensory, social, motor, language, and self-care domains.",
  },
  category: "Child Development",
  tags: ["儿童发育", "孤独症", "自闭症", "筛查"],
  interactionMode: "voice_guided",
  supportedLanguages: ["zh", "en"],
  requiresConfirmation: true,
  questions: ABC_QUESTIONS,

  calculateScore: (answers: number[]) => {
    const totalScore = answers.reduce((sum, score) => sum + score, 0);

    let conclusion: string;
    let details = { level: "", description: "" };

    if (totalScore >= 68) {
      conclusion = "高度疑似";
      details = {
        level: "高度疑似",
        description: "孤独症相关行为特征非常明显，强烈建议立即前往儿童精神科或发育行为科进行专业临床医学评估。",
      };
    } else if (totalScore >= 53) {
      conclusion = "边缘/疑似界限";
      details = {
        level: "边缘/疑似界限",
        description: "存在较多孤独症相关特征，具有一定的临床风险，建议尽快咨询专业医生做进一步的筛查与观察。",
      };
    } else {
      conclusion = "正常范围/非典型";
      details = {
        level: "正常范围/非典型",
        description: "目前评估总分未达到典型的孤独症筛查界限，但若家长仍对孩子的发育有疑虑，建议保持日常观察。",
      };
    }

    return { totalScore, conclusion, details };
  },
};
