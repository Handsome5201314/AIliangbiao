import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendDoctorBotAssessmentResultMessage, submitDoctorBotAssessmentAnswer } from '@/lib/services/doctor-bot';

const requestSchema = z.object({
  visitorSessionId: z.string().min(1),
  questionId: z.number(),
  score: z.number(),
  language: z.enum(['zh', 'en']).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string; sessionId: string }> }
) {
  try {
    const { slug, sessionId } = await context.params;
    const body = requestSchema.parse(await request.json());
    const session = await submitDoctorBotAssessmentAnswer({
      slug,
      visitorSessionId: body.visitorSessionId,
      sessionId,
      questionId: body.questionId,
      score: body.score,
    });

    let followUp = null;
    if (session.result) {
      followUp = await sendDoctorBotAssessmentResultMessage({
        slug,
        visitorSessionId: body.visitorSessionId,
        result: {
          scaleId: session.scaleId,
          totalScore: session.result.totalScore,
          conclusion: session.result.conclusion,
          details: session.result.details,
        },
        language: body.language,
      });
    }

    return NextResponse.json({
      success: true,
      session,
      followUp: followUp ? followUp.reply : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit assessment answer' },
      { status: 422 }
    );
  }
}
