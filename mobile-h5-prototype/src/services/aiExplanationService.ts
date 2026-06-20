import type { AssessmentMode, Option, QuickQuestionType } from '@/types';
import { apiRequest, getAuthHeaders } from '@/services/authService';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const DISCLAIMER =
  'AI 只能帮助解释题意，不能替你选择答案，也不能作为诊断结论。';

// ─── Question Explanation ──────────────────────────────────────────────────────

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
  const optionText = params.options.length
    ? `\n\n本题选项包括：${params.options.map((option) => option.label).join('、')}。`
    : '';
  const modeHint =
    params.mode === 'doctor_assisted'
      ? '可用更口语化的方式向家长确认近一段时间的真实观察，不要诱导家长选择特定答案。'
      : '请结合孩子近一段时间的日常表现作答，不需要追求某一次事件的绝对准确。';

  const explanation = `这道题关注的是：${params.questionText}\n\n${modeHint}${optionText}`;

  await apiRequest('/api/research/ai-interactions', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      memberProfileId: params.memberId || null,
      assessmentSessionId: params.sessionId || null,
      scaleId: params.scaleId,
      questionId: params.questionId,
      interactionType: 'QUESTION_EXPLANATION',
      prompt: params.questionText,
      responseSummary: explanation,
      metadata: {
        mode: params.mode || 'caregiver_self',
        optionCount: params.options.length,
      },
    }),
  });

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
  _questionId: string,
  quickType: QuickQuestionType,
): Promise<string> {
  switch (quickType) {
    case 'meaning':
      return '题意说明：这类问题用于了解孩子在真实生活场景中的稳定表现，请按最近一段时间的总体情况判断。';

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
      return '请结合孩子近一段时间的日常表现作答。';
  }
}
