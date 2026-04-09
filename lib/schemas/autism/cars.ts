import carsContent from "@/data/scale-content/cars.content.json";

import type { ExecutableScaleDefinition, ScaleOption, ScaleQuestion } from "../core/types";

type CarsContentOption = {
  label: string;
  description?: string;
  aliases?: string[];
};

type CarsContentQuestion = {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  options: CarsContentOption[];
  notes?: string;
};

type CarsContentFile = {
  version?: string;
  questions: CarsContentQuestion[];
};

const CARS_OPTION_SCORES = [1, 2, 3, 4];

function buildCarsOptionScore(optionIndex: number) {
  return CARS_OPTION_SCORES[optionIndex];
}

function assertCarsContentShape(content: CarsContentFile): asserts content is CarsContentFile {
  if (!Array.isArray(content.questions) || content.questions.length !== 15) {
    throw new Error(`CARS content must contain exactly 15 questions, received ${content.questions?.length ?? 0}`);
  }

  const ids = new Set<number>();
  content.questions.forEach((question, index) => {
    if (typeof question.id !== "number") {
      throw new Error(`CARS content question at index ${index} is missing a numeric id`);
    }
    if (question.id !== index + 1) {
      throw new Error(
        `CARS content question ids must be continuous from 1 to 15. Expected ${index + 1}, received ${question.id}`
      );
    }
    if (ids.has(question.id)) {
      throw new Error(`CARS content has duplicated question id: ${question.id}`);
    }
    ids.add(question.id);

    if (!question.text?.trim()) {
      throw new Error(`CARS question ${question.id} is missing text`);
    }
    if (!question.clinical_intent?.trim()) {
      throw new Error(`CARS question ${question.id} is missing clinical_intent`);
    }
    if (!question.colloquial?.trim()) {
      throw new Error(`CARS question ${question.id} is missing colloquial`);
    }
    if (!Array.isArray(question.fallback_examples)) {
      throw new Error(`CARS question ${question.id} fallback_examples must be an array`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`CARS question ${question.id} must define exactly 4 options`);
    }

    question.options.forEach((option, optionIndex) => {
      if (!option.label?.trim()) {
        throw new Error(`CARS question ${question.id} option ${optionIndex + 1} is missing label`);
      }
      if (option.aliases !== undefined && !Array.isArray(option.aliases)) {
        throw new Error(`CARS question ${question.id} option ${optionIndex + 1} aliases must be an array`);
      }
    });
  });
}

function buildCarsQuestions(content: CarsContentFile): ScaleQuestion[] {
  assertCarsContentShape(content);

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
      score: buildCarsOptionScore(index),
    })),
  }));
}

const CARS_QUESTIONS: ScaleQuestion[] = buildCarsQuestions(carsContent as CarsContentFile);

export const CARS_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "CARS",
  version: "1.0",
  title: {
    zh: "卡氏儿童孤独症评定量表 (CARS)",
    en: "Childhood Autism Rating Scale (CARS)",
  },
  description: {
    zh: "用于评估和诊断儿童孤独症的严重程度，涵盖人际关系、视觉反应、情感表现等15个核心维度的行为表现。满分60分，正常范围<30分。",
    en: "A diagnostic scale for rating autism severity across 15 core behavioral dimensions.",
  },
  category: "Child Development",
  tags: ["儿童发育", "孤独症", "诊断", "自闭症"],
  questions: CARS_QUESTIONS,

  calculateScore: (answers: number[]) => {
    const safeAnswers = answers.length === 15 ? answers : [...answers, ...Array(15 - answers.length).fill(1)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let conclusion: string;
    let detailsStr = `【CARS总分】: ${totalScore}/60分\n\n`;

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
        description: detailsStr,
      },
    };
  },
};
