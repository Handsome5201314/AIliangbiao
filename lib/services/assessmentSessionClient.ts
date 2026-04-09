import type { ScaleQuestion, ScaleScoreResult } from '@/lib/schemas/core/types';

export interface AssessmentSessionClientState {
  sessionId: string;
  scaleId: string;
  status: 'draft' | 'collecting_form' | 'questioning' | 'completed' | 'cancelled';
  channel: 'web' | 'voice' | 'agent' | 'mcp';
  currentQuestionIndex: number | null;
  questionCount: number;
  answeredCount: number;
  answers: Array<number | null>;
  formData?: Record<string, string | number | null>;
  currentQuestion?: ScaleQuestion;
  result?: ScaleScoreResult;
  assessmentId?: string;
}

async function parseSessionResponse(response: Response): Promise<AssessmentSessionClientState> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Assessment session request failed');
  }

  return payload.session as AssessmentSessionClientState;
}

export async function createSkillAssessmentSession(input: {
  scaleId: string;
  skillToken: string;
  memberId?: string;
  formData?: Record<string, string | number | null>;
  channel?: 'web' | 'voice' | 'agent' | 'mcp';
}) {
  const response = await fetch(`/api/skill/v1/scales/${encodeURIComponent(input.scaleId)}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.skillToken}`,
    },
    body: JSON.stringify({
      memberId: input.memberId,
      formData: input.formData,
      channel: input.channel || 'web',
    }),
  });

  return parseSessionResponse(response);
}

export async function getSkillAssessmentSession(input: { sessionId: string; skillToken: string }) {
  const response = await fetch(`/api/skill/v1/scales/sessions/${encodeURIComponent(input.sessionId)}`, {
    headers: {
      Authorization: `Bearer ${input.skillToken}`,
    },
  });

  return parseSessionResponse(response);
}

export async function answerSkillAssessmentSession(input: {
  sessionId: string;
  skillToken: string;
  score?: number;
  questionId?: number;
  formData?: Record<string, string | number | null>;
}) {
  const response = await fetch(
    `/api/skill/v1/scales/sessions/${encodeURIComponent(input.sessionId)}/answer`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.skillToken}`,
      },
      body: JSON.stringify({
        score: input.score,
        questionId: input.questionId,
        formData: input.formData,
      }),
    }
  );

  return parseSessionResponse(response);
}

export async function backSkillAssessmentSession(input: { sessionId: string; skillToken: string }) {
  const response = await fetch(
    `/api/skill/v1/scales/sessions/${encodeURIComponent(input.sessionId)}/back`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.skillToken}`,
      },
    }
  );

  return parseSessionResponse(response);
}

export async function cancelSkillAssessmentSession(input: { sessionId: string; skillToken: string }) {
  const response = await fetch(
    `/api/skill/v1/scales/sessions/${encodeURIComponent(input.sessionId)}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.skillToken}`,
      },
    }
  );

  return parseSessionResponse(response);
}
