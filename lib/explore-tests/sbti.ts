import rawSbtiData from '@/data/explore-tests/sbti.json';

import type {
  ExploreTestDimensionMeta,
  ExploreTestQuestion,
  ExploreTestRankedType,
  ExploreTestTypeProfile,
} from './types';

type SbtiRawData = {
  dimensionMeta: Record<string, ExploreTestDimensionMeta>;
  questions: ExploreTestQuestion[];
  specialQuestions: ExploreTestQuestion[];
  typeLibrary: Record<string, ExploreTestTypeProfile>;
  dimExplanations: Record<string, Record<'L' | 'M' | 'H', string>>;
  dimensionOrder: string[];
  normalTypes: Array<{ code: string; pattern: string }>;
  drinkTriggerQuestionId: string;
};

type SbtiLevel = 'L' | 'M' | 'H';

export interface SbtiQuestion extends ExploreTestQuestion {
  dim?: string;
}

export interface SbtiResult {
  rawScores: Record<string, number>;
  levels: Record<string, SbtiLevel>;
  ranked: ExploreTestRankedType[];
  bestNormal: ExploreTestRankedType;
  finalType: ExploreTestTypeProfile;
  modeKicker: string;
  badge: string;
  sub: string;
  special: boolean;
  secondaryType: ExploreTestRankedType | null;
  topDimensions: Array<{
    dim: string;
    rawScore: number;
    level: SbtiLevel;
    name: string;
    model: string;
    explanation: string;
  }>;
}

const SBTI_DATA = rawSbtiData as SbtiRawData;
const STORAGE_NAMESPACE = 'explore_test:sbti';

export const SBTI_SOURCE = {
  siteUrl: 'https://sbti.unun.dev',
  author: 'B站 @蛆肉儿串儿',
  disclaimer:
    '本测试为网络流行的自我探索内容，不属于临床评估工具。结果仅供娱乐和自我观察参考，不应替代专业量表、心理评估或医疗意见。',
};

export const SBTI_STORAGE_KEYS = {
  session: `${STORAGE_NAMESPACE}:session`,
  result: `${STORAGE_NAMESPACE}:result`,
};

export const SBTI_DIMENSION_META = SBTI_DATA.dimensionMeta;
export const SBTI_DIMENSION_ORDER = SBTI_DATA.dimensionOrder;
export const SBTI_DIMENSION_EXPLANATIONS = SBTI_DATA.dimExplanations;
export const SBTI_REGULAR_QUESTIONS = SBTI_DATA.questions;
export const SBTI_SPECIAL_QUESTIONS = SBTI_DATA.specialQuestions;
export const SBTI_TYPE_LIBRARY = SBTI_DATA.typeLibrary;
export const SBTI_TYPE_PATTERNS = SBTI_DATA.normalTypes;
export const SBTI_DRUNK_TRIGGER_QUESTION_ID = SBTI_DATA.drinkTriggerQuestionId;

const SBTI_GATE_QUESTION = SBTI_SPECIAL_QUESTIONS.find((item) => item.id === 'drink_gate_q1');
const SBTI_TRIGGER_QUESTION = SBTI_SPECIAL_QUESTIONS.find((item) => item.id === 'drink_gate_q2');

function sumToLevel(score: number): SbtiLevel {
  if (score <= 3) return 'L';
  if (score === 4) return 'M';
  return 'H';
}

function levelNum(level: SbtiLevel) {
  return { L: 1, M: 2, H: 3 }[level];
}

function parsePattern(pattern: string) {
  return pattern.replace(/-/g, '').split('') as SbtiLevel[];
}

function cloneQuestion(question: SbtiQuestion) {
  return {
    ...question,
    options: question.options.map((option) => ({ ...option })),
  };
}

export function buildSbtiQuestionDeck() {
  const shuffledRegular = [...SBTI_REGULAR_QUESTIONS]
    .map(cloneQuestion)
    .sort(() => Math.random() - 0.5);

  if (!SBTI_GATE_QUESTION) {
    return shuffledRegular;
  }

  const insertIndex = Math.floor(Math.random() * shuffledRegular.length) + 1;
  return [
    ...shuffledRegular.slice(0, insertIndex),
    cloneQuestion(SBTI_GATE_QUESTION),
    ...shuffledRegular.slice(insertIndex),
  ];
}

export function getVisibleSbtiQuestions(
  orderedQuestions: SbtiQuestion[],
  answers: Record<string, number>
) {
  const visible = [...orderedQuestions];
  const gateIndex = visible.findIndex((item) => item.id === SBTI_GATE_QUESTION?.id);

  if (gateIndex !== -1 && answers[SBTI_GATE_QUESTION!.id] === 3 && SBTI_TRIGGER_QUESTION) {
    visible.splice(gateIndex + 1, 0, cloneQuestion(SBTI_TRIGGER_QUESTION));
  }

  return visible;
}

export function sanitizeSbtiAnswers(
  answers: Record<string, number>,
  visibleQuestions: SbtiQuestion[]
) {
  const visibleIds = new Set(visibleQuestions.map((item) => item.id));
  return Object.fromEntries(Object.entries(answers).filter(([key]) => visibleIds.has(key)));
}

export function isSbtiQuestionDeckComplete(
  orderedQuestions: SbtiQuestion[],
  answers: Record<string, number>
) {
  const visibleQuestions = getVisibleSbtiQuestions(orderedQuestions, answers);
  return visibleQuestions.every((question) => answers[question.id] !== undefined);
}

export function computeSbtiResult(answers: Record<string, number>): SbtiResult {
  const rawScores: Record<string, number> = {};
  const levels = {} as Record<string, SbtiLevel>;
  Object.keys(SBTI_DIMENSION_META).forEach((dimension) => {
    rawScores[dimension] = 0;
  });

  SBTI_REGULAR_QUESTIONS.forEach((question) => {
    if (!question.dim) {
      return;
    }
    rawScores[question.dim] += Number(answers[question.id] || 0);
  });

  Object.entries(rawScores).forEach(([dimension, score]) => {
    levels[dimension] = sumToLevel(score);
  });

  const userVector = SBTI_DIMENSION_ORDER.map((dimension) => levelNum(levels[dimension]));
  const ranked = SBTI_TYPE_PATTERNS.map((pattern) => {
    const vector = parsePattern(pattern.pattern).map(levelNum);
    let distance = 0;
    let exact = 0;

    for (let index = 0; index < vector.length; index += 1) {
      const diff = Math.abs(userVector[index] - vector[index]);
      distance += diff;
      if (diff === 0) {
        exact += 1;
      }
    }

    const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));
    return {
      ...pattern,
      ...SBTI_TYPE_LIBRARY[pattern.code],
      distance,
      exact,
      similarity,
    };
  }).sort((left, right) => {
    if (left.distance !== right.distance) return left.distance - right.distance;
    if (right.exact !== left.exact) return right.exact - left.exact;
    return right.similarity - left.similarity;
  });

  const bestNormal = ranked[0];
  const drunkTriggered = answers[SBTI_DRUNK_TRIGGER_QUESTION_ID] === 2;

  let finalType: ExploreTestTypeProfile = bestNormal;
  let modeKicker = '你的主类型';
  let badge = `匹配度 ${bestNormal.similarity}% · 精准命中 ${bestNormal.exact}/15 维`;
  let sub = '维度命中度较高，当前结果可视为你的第一人格画像。';
  let special = false;
  let secondaryType: ExploreTestRankedType | null = null;

  if (drunkTriggered) {
    finalType = SBTI_TYPE_LIBRARY.DRUNK;
    secondaryType = bestNormal;
    modeKicker = '隐藏人格已激活';
    badge = '匹配度 100% · 酒精异常因子已接管';
    sub = '乙醇亲和性过强，系统已直接跳过常规人格审判。';
    special = true;
  } else if (bestNormal.similarity < 60) {
    finalType = SBTI_TYPE_LIBRARY.HHHH;
    modeKicker = '系统强制兜底';
    badge = `标准人格库最高匹配仅 ${bestNormal.similarity}%`;
    sub = '标准人格库对你的脑回路集体罢工了，于是系统把你强制分配给了 HHHH。';
    special = true;
  }

  const topDimensions = [...SBTI_DIMENSION_ORDER]
    .sort((left, right) => {
      const rawDiff = rawScores[right] - rawScores[left];
      return rawDiff !== 0 ? rawDiff : SBTI_DIMENSION_ORDER.indexOf(left) - SBTI_DIMENSION_ORDER.indexOf(right);
    })
    .slice(0, 3)
    .map((dimension) => ({
      dim: dimension,
      rawScore: rawScores[dimension],
      level: levels[dimension],
      name: SBTI_DIMENSION_META[dimension].name,
      model: SBTI_DIMENSION_META[dimension].model,
      explanation: SBTI_DIMENSION_EXPLANATIONS[dimension][levels[dimension]],
    }));

  return {
    rawScores,
    levels,
    ranked,
    bestNormal,
    finalType,
    modeKicker,
    badge,
    sub,
    special,
    secondaryType,
    topDimensions,
  };
}
