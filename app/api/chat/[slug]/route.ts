import { NextRequest, NextResponse } from 'next/server';

import { getPublishedDoctorBotBySlug } from '@/lib/services/doctor-bot';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const data = await getPublishedDoctorBotBySlug(slug);
    return NextResponse.json({
      success: true,
      bot: data.publicInfo,
      enabledScales: data.enabledScales.map((scale) => ({
        id: scale.id,
        title: scale.title,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bot not found' },
      { status: 404 }
    );
  }
}
