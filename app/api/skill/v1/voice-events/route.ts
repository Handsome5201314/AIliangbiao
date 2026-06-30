import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { recordAiConversationEvent } from '@/lib/services/ai-conversation-log';

const eventSchema = z.object({
  conversationSessionId: z.string().optional(),
  memberProfileId: z.string().optional(),
  assessmentSessionId: z.string().optional(),
  assessmentHistoryId: z.string().optional(),
  doctorProfileId: z.string().optional(),
  scaleId: z.string().optional(),
  questionId: z.number().optional(),
  hermesConversationId: z.string().optional(),
  eventType: z.enum([
    'assistant_prompt',
    'answer_confirmation',
    'tool_call',
    'tts_output',
    'fallback',
    'error',
    'assessment_answer_committed',
  ]),
  provider: z.string().optional(),
  model: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  confirmedLowConfidence: z.boolean().optional(),
  transcriptText: z.string().optional(),
  assistantText: z.string().optional(),
  summary: z.string().optional(),
  errorMessage: z.string().optional(),
  fallbackReason: z.string().optional(),
  metadata: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = authenticateSkillRequest(request, 'skill:voice-intent');
    const body = eventSchema.parse(await request.json());

    const logged = await recordAiConversationEvent({
      ...body,
      userId: session.sub,
    });

    return NextResponse.json({
      success: true,
      conversationSessionId: logged.session.id,
      eventId: logged.event.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record voice event' },
      { status: 401 }
    );
  }
}
