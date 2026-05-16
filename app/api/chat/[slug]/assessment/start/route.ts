import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { startDoctorBotAssessment } from '@/lib/services/doctor-bot';

const requestSchema = z.object({
  visitorSessionId: z.string().min(1),
  scaleId: z.string().min(1),
  language: z.enum(['zh', 'en']).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = requestSchema.parse(await request.json());
    const data = await startDoctorBotAssessment({
      slug,
      visitorSessionId: body.visitorSessionId,
      scaleId: body.scaleId,
      language: body.language,
    });

    return NextResponse.json({
      success: true,
      session: data.session,
      scale: data.scale,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start assessment' },
      { status: 422 }
    );
  }
}
