import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorBotConfigForDoctor, saveDoctorBotConfig } from '@/lib/services/doctor-bot';

const requestSchema = z.object({
  assistantName: z.string().min(1),
  avatarUrl: z.string().optional(),
  welcomeMessage: z.string().optional(),
  publicSlug: z.string().min(1),
  fastgptBaseUrl: z.string().min(1),
  fastgptApiKey: z.string().optional(),
  enabledScaleIds: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'disabled']).default('draft'),
  hermesEnabled: z.boolean().optional(),
  knowledgeMode: z.enum(['platform_proxy', 'direct_fastgpt']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireDoctorUser(request);
    const data = await getDoctorBotConfigForDoctor({
      doctorProfileId: doctorProfile.id,
      language: 'zh',
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireDoctorUser(request);
    const body = requestSchema.parse(await request.json());

    const config = await saveDoctorBotConfig({
      doctorProfileId: doctorProfile.id,
      config: body,
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save doctor workspace config' },
      { status }
    );
  }
}
