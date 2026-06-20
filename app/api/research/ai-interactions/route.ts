import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthenticatedUser } from '@/lib/auth/require-app-session';
import { recordAiInteraction } from '@/lib/services/research-events';

const requestSchema = z.object({
  memberProfileId: z.string().optional().nullable(),
  assessmentSessionId: z.string().optional().nullable(),
  assessmentHistoryId: z.string().optional().nullable(),
  scaleId: z.string().optional().nullable(),
  questionId: z.union([z.string(), z.number()]).optional().nullable(),
  interactionType: z.string().min(1).default('QUESTION_EXPLANATION'),
  prompt: z.string().optional().nullable(),
  responseSummary: z.string().optional().nullable(),
  metadata: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthenticatedUser(request);
    const payload = requestSchema.parse(await request.json());
    const record = await recordAiInteraction({
      actor,
      ...payload,
      questionId: payload.questionId === null || payload.questionId === undefined ? null : String(payload.questionId),
    });

    return NextResponse.json({ id: record.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid AI interaction payload' }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
