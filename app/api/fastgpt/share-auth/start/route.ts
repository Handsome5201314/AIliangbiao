import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handleFastgptShareStart } from '@/lib/services/fastgpt-embed';

const requestSchema = z.object({
  token: z.string().min(1),
  question: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await handleFastgptShareStart(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Invalid request body',
        msg: error instanceof Error ? error.message : 'Invalid request body',
      },
      { status: 400 }
    );
  }
}
