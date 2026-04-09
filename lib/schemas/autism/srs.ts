import srsContent from "@/data/scale-content/srs.content.json";

import type { ExecutableScaleDefinition, ScaleOption, ScaleQuestion } from "../core/types";

type SrsContentOption = {
  label: string;
  description?: string;
  aliases?: string[];
};

type SrsContentQuestion = {
  id: number;
  text: string;
  clinical_intent: string;
  colloquial: string;
  fallback_examples: string[];
  options: SrsContentOption[];
  notes?: string;
};

type SrsContentFile = {
  version?: string;
  questions: SrsContentQuestion[];
};

const REVERSE_QUESTION_IDS = new Set([3, 7, 11, 12, 15, 17, 21, 22, 26, 32, 38, 40, 43, 45, 48, 52, 55]);

function buildSrsOptionScore(questionId: number, optionIndex: number) {
  const scores = REVERSE_QUESTION_IDS.has(questionId) ? [4, 3, 2, 1] : [1, 2, 3, 4];
  return scores[optionIndex];
}

function assertSrsContentShape(content: SrsContentFile): asserts content is SrsContentFile {
  if (!Array.isArray(content.questions) || content.questions.length !== 65) {
    throw new Error(`SRS content must contain exactly 65 questions, received ${content.questions?.length ?? 0}`);
  }

  const ids = new Set<number>();
  content.questions.forEach((question, index) => {
    if (typeof question.id !== "number") {
      throw new Error(`SRS content question at index ${index} is missing a numeric id`);
    }
    if (question.id !== index + 1) {
      throw new Error(
        `SRS content question ids must be continuous from 1 to 65. Expected ${index + 1}, received ${question.id}`
      );
    }
    if (ids.has(question.id)) {
      throw new Error(`SRS content has duplicated question id: ${question.id}`);
    }
    ids.add(question.id);

    if (!question.text?.trim()) {
      throw new Error(`SRS question ${question.id} is missing text`);
    }
    if (!question.clinical_intent?.trim()) {
      throw new Error(`SRS question ${question.id} is missing clinical_intent`);
    }
    if (!question.colloquial?.trim()) {
      throw new Error(`SRS question ${question.id} is missing colloquial`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`SRS question ${question.id} must define exactly 4 options`);
    }
    if (!Array.isArray(question.fallback_examples)) {
      throw new Error(`SRS question ${question.id} fallback_examples must be an array`);
    }

    question.options.forEach((option, optionIndex) => {
      if (!option.label?.trim()) {
        throw new Error(`SRS question ${question.id} option ${optionIndex + 1} is missing label`);
      }
      if (option.aliases !== undefined && !Array.isArray(option.aliases)) {
        throw new Error(`SRS question ${question.id} option ${optionIndex + 1} aliases must be an array`);
      }
    });
  });
}

function buildSrsQuestions(content: SrsContentFile): ScaleQuestion[] {
  assertSrsContentShape(content);

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
      score: buildSrsOptionScore(question.id, index),
    })),
  }));
}

const SRS_QUESTIONS: ScaleQuestion[] = buildSrsQuestions(srsContent as SrsContentFile);

export const SRS_Scale: ExecutableScaleDefinition = {
  source: "builtin",
  id: "SRS",
  version: "1.0",
  title: {
    zh: "社交反应量表 (SRS)",
    en: "Social Responsiveness Scale (SRS)",
  },
  description: {
    zh: "用于评估儿童在自然社会环境中的社交互动能力，识别孤独症谱系障碍相关的社交缺陷。共65题。",
    en: "A scale for assessing social interaction difficulties related to autism spectrum conditions.",
  },
  category: "Child Development",
  tags: ["儿童发育", "社交", "孤独症", "社交能力"],
  questions: SRS_QUESTIONS,

  calculateScore: (answers: number[]) => {
    const safeAnswers = answers.length === 65 ? answers : [...answers, ...Array(65 - answers.length).fill(1)];

    const totalScore = safeAnswers.reduce((sum, score) => sum + score, 0);

    let conclusion: string;
    let detailsStr = `【总粗分】: ${totalScore}/260分\n\n`;

    if (totalScore >= 100) {
      conclusion = "重度异常";
      detailsStr += "临床建议：在社交互动、沟通及刻板行为方面存在显著且严重的困难，强烈建议立即寻求儿童精神专科医生进行系统的评估与干预指导。";
    } else if (totalScore >= 75) {
      conclusion = "轻/中度异常";
      detailsStr += "临床建议：存在较为明显的社交互动挑战或孤独症特征，建议在日常密切观察，并尽早咨询专业机构进行筛查确认。";
    } else {
      conclusion = "正常范围";
      detailsStr += "临床建议：目前的得分显示社交互动能力在同龄正常范围内，暂未发现明显的孤独症核心社交缺陷症状。";
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
