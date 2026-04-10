import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { QuotaManager } from '@/lib/auth/quotaManager';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { assertAccessibleMember } from '@/lib/assessment-skill/member-service';
import { evaluateSkillScale } from '@/lib/assessment-skill/scale-service';

const requestSchema = z.object({
  memberId: z.string().optional(),
  answers: z.array(z.number()),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:evaluate');
    const body = requestSchema.parse(await request.json());
    const { scaleId } = await context.params;
    const memberId = body.memberId || session.member_id;

    await assertAccessibleMember(session.sub, memberId);

    const canConsume = await QuotaManager.consumeQuota(session.device_id);
    if (!canConsume) {
      return NextResponse.json(
        { error: 'Quota exceeded for today' },
        { status: 403 }
      );
    }

    const result = await evaluateSkillScale({
      userId: session.sub,
      profileId: memberId,
      scaleId,
      answers: body.answers,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate scale' },
      { status }
    );
  }
}
