import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { appendMemberMemoryNote } from '@/lib/assessment-skill/member-service';

const requestSchema = z.object({
  note: z.string().min(1),
  source: z.string().min(1).default('agent'),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:memory:write');
    const { memberId } = await context.params;
    if (memberId !== session.member_id) {
      return NextResponse.json({ error: 'Forbidden member access' }, { status: 403 });
    }

    const body = requestSchema.parse(await request.json());
    const result = await appendMemberMemoryNote({
      userId: session.sub,
      memberId,
      note: body.note,
      source: body.source,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status }
    );
  }
}
