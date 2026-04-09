import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { assertAccessibleMember } from '@/lib/assessment-skill/member-service';
import { createAssessmentSession } from '@/lib/assessment-skill/session-service';

const requestSchema = z.object({
  memberId: z.string().optional(),
  formData: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  channel: z.enum(['web', 'voice', 'agent', 'mcp']).optional(),
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

    const assessmentSession = await createAssessmentSession({
      userId: session.sub,
      profileId: memberId,
      scaleId,
      channel: body.channel || 'web',
      formData: body.formData,
      deviceId: session.device_id,
    });

    return NextResponse.json({
      success: true,
      session: assessmentSession,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create assessment session' },
      { status }
    );
  }
}
