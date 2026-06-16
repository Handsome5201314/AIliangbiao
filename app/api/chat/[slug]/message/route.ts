import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { DoctorBotChatError } from '@/lib/services/doctor-bot';
import { sendDoctorBotConversationTurn } from '@/lib/realtime/doctor-bot-conversation';

const requestSchema = z.object({
  visitorSessionId: z.string().min(1),
  content: z.string().min(1),
  language: z.enum(['zh', 'en']).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = requestSchema.parse(await request.json());
    const data = await sendDoctorBotConversationTurn({
      slug,
      visitorSessionId: body.visitorSessionId,
      content: body.content,
      language: body.language,
      requestedBackend: 'hermes',
    });

    return NextResponse.json({
      success: true,
      session: data.session,
      reply: data.reply,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send chat message';
    const status =
      error instanceof DoctorBotChatError
        ? error.statusCode
        : message === 'Doctor assistant not found or not published'
          ? 404
          : 422;

    return NextResponse.json(
      {
        error: message,
        ...(error instanceof DoctorBotChatError ? { code: error.code, data: error.data } : {}),
      },
      { status }
    );
  }
}
