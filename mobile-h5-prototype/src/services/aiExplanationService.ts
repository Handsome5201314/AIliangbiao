import type { AssessmentMode, Option, QuickQuestionType } from '@/types';
import { aiExplanations } from '@/data/mockData';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const DISCLAIMER =
  'AI 只能帮助解释题意，不能替你选择答案，也不能作为诊断结论。';

// ─── Question Explanation ──────────────────────────────────────────────────────

/**
 * Get an AI-generated explanation for a specific question.
 * In production this would call the backend AI service.
 * TODO: GET /api/platform/v1/ai/explanations/question
 */
export async function getQuestionExplanation(params: {
  scaleId: string;
  questionId: string;
  questionText: string;
  options: Option[];
  memberId?: string;
  sessionId?: string;
  mode?: AssessmentMode;
}): Promise<{
  questionId: string;
  questionText: string;
  explanation: string;
  disclaimer: string;
  timestamp: number;
}> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const explanation =
    aiExplanations[params.questionId] ??
    `这道题（"${params.questionText}"）用于评估孩子在日常生活中的相关行为表现。请根据孩子近6个月的实际情况，选择最符合的选项。如果不确定，可以先跳过，稍后再回来作答。`;

  return {
    questionId: params.questionId,
    questionText: params.questionText,
    explanation,
    disclaimer: DISCLAIMER,
    timestamp: Date.now(),
  };
}

// ─── Quick Explanation ─────────────────────────────────────────────────────────

/**
 * Get a quick inline explanation based on the user's question type.
 */
export async function getQuickExplanation(
  questionId: string,
  quickType: QuickQuestionType,
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const baseExplanation =
    aiExplanations[questionId] ?? '暂无该题的详细解释。';

  switch (quickType) {
    case 'meaning':
      return `题意说明：${baseExplanation}`;

    case 'options':
      return (
        '选项说明：0分代表该行为完全没有出现，1分代表偶尔出现，' +
        '2分代表比较常见，3分代表非常频繁。请根据孩子近6个月的表现选择最接近的一项。'
      );

    case 'example':
      return (
        '举例说明：比如孩子在吃饭时能不能安静坐着、做作业时会不会频繁走神。' +
        '请关注行为出现的频率，而非单次事件。'
      );

    case 'unsure':
      return (
        '如果不确定该怎么选，可以回忆孩子最近一周的表现。' +
        '也可以先跳过这道题，等其他题目做完后再回来。不确定的题目不会影响整体评估的参考价值。'
      );

    case 'explain-to-parent':
      return (
        '给家长的解释：这道题想了解的是孩子平时的一些行为习惯，没有对错之分。' +
        '您只需要根据平时的观察来回答就好，不用担心选"错"。' +
        '所有信息仅用于辅助评估，不会作为任何诊断依据。'
      );

    default:
      return baseExplanation;
  }
}
