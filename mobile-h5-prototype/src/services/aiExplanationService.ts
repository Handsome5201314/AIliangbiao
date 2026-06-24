import type { AssessmentMode, Option, QuickQuestionType } from '@/types';
import { apiRequest, getAuthHeaders } from '@/services/authService';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const DISCLAIMER =
  'AI 只能帮助解释题意，不能替你选择答案，也不能作为诊断结论。';

const STORAGE_KEY_H5_DEVICE_ID = 'h5_device_id';

type BackendQuestionExplanationResponse = {
  explanation?: {
    exact?: {
      platform?: {
        content?: string;
      };
      organization?: Array<{
        title?: string;
        content?: string;
      }>;
      doctor?: Array<{
        title?: string;
        content?: string;
      }>;
    };
    retrieval?: Array<{
      content?: string;
      contentText?: string;
      docTitle?: string;
    }>;
  };
};

export function getOrCreateH5DeviceId() {
  let deviceId = localStorage.getItem(STORAGE_KEY_H5_DEVICE_ID);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_H5_DEVICE_ID, deviceId);
  }
  return deviceId;
}

function renderBackendExplanation(data: BackendQuestionExplanationResponse) {
  const explanation = data.explanation;
  const platform = explanation?.exact?.platform?.content?.trim();
  const organization = explanation?.exact?.organization || [];
  const doctor = explanation?.exact?.doctor || [];
  const retrieval = explanation?.retrieval || [];

  const sections = [
    platform,
    ...organization.map((item) => `${item.title || '机构补充'}：${item.content || ''}`.trim()),
    ...doctor.map((item) => `${item.title || '医生补充'}：${item.content || ''}`.trim()),
    ...retrieval.map((item) =>
      `${item.docTitle || '已审核知识'}：${item.content || item.contentText || ''}`.trim()
    ),
  ].filter((item): item is string => Boolean(item));

  if (!sections.length) {
    throw new Error('题目解释库未返回可展示内容');
  }

  return sections.join('\n\n');
}

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
  const numericQuestionId = Number(params.questionId);
  if (!Number.isInteger(numericQuestionId) || numericQuestionId <= 0) {
    throw new Error('题目 ID 不合法，无法获取题目解释');
  }

  const backend = await apiRequest<BackendQuestionExplanationResponse>(
    '/api/platform/v1/ai/explanations/question',
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        deviceId: getOrCreateH5DeviceId(),
        memberId: params.memberId,
        scaleId: params.scaleId,
        questionId: numericQuestionId,
        language: 'zh',
      }),
    },
  );
  const explanation = renderBackendExplanation(backend);

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
