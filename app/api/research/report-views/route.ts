import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthenticatedUser } from '@/lib/auth/require-app-session';
import { recordReportView } from '@/lib/services/research-events';

const requestSchema = z.object({
  memberProfileId: z.string().optional().nullable(),
  assessmentSessionId: z.string().optional().nullable(),
  assessmentHistoryId: z.string().optional().nullable(),
  viewerRole: z.string().optional().nullable(),
  metadata: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthenticatedUser(request);
    const payload = requestSchema.parse(await request.json());
    const record = await recordReportView({
      actor,
      ...payload,
    });

    return NextResponse.json({ id: record.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid report view payload' }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
