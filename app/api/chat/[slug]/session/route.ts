import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrCreateDoctorBotChatSession } from '@/lib/services/doctor-bot';

const requestSchema = z.object({
  visitorSessionId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = requestSchema.parse(await request.json());
    const data = await getOrCreateDoctorBotChatSession({
      slug,
      visitorSessionId: body.visitorSessionId,
    });

    return NextResponse.json({
      success: true,
      session: {
        id: data.session.id,
        visitorSessionId: data.session.visitorSessionId,
        chatId: data.session.chatId,
      },
      activeAssessment: data.activeAssessment || null,
      bot: data.publicInfo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize chat session' },
      { status: 404 }
    );
  }
}
