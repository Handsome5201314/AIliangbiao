import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireDoctorUser } from '@/lib/auth/require-app-session';
import { testDoctorBotConnection } from '@/lib/services/doctor-bot';

const requestSchema = z.object({
  fastgptBaseUrl: z.string().min(1),
  fastgptApiKey: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await requireDoctorUser(request);
    const body = requestSchema.parse(await request.json());
    const result = await testDoctorBotConnection(body);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'FastGPT connection test failed' },
      { status }
    );
  }
}
