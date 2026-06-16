import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveAgentSessionContext } from '@/lib/services/agent-session';
import { createFastgptEmbedSession } from '@/lib/services/fastgpt-embed';

const LEGACY_FASTGPT_EMBED_SESSION_ROUTE = true;

const requestSchema = z.object({
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
  expertKey: z.string().optional(),
  memberSnapshot: z
    .object({
      nickname: z.string().optional(),
      gender: z.string().optional(),
      ageMonths: z.number().optional(),
      relation: z.string().optional(),
      languagePreference: z.string().optional(),
      interests: z.array(z.string()).optional(),
      fears: z.array(z.string()).optional(),
      avatarConfig: z.unknown().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    void LEGACY_FASTGPT_EMBED_SESSION_ROUTE;
    const body = requestSchema.parse(await request.json());
    const { user, member, activeAccountType } = await resolveAgentSessionContext({
      request,
      deviceId: body.deviceId,
      memberId: body.memberId,
      memberSnapshot: body.memberSnapshot,
    });

    const session = await createFastgptEmbedSession({
      userId: user.id,
      memberId: member.id,
      deviceId: body.deviceId,
      accountType: activeAccountType || 'PATIENT',
      role: (user.role || 'GUEST') as 'GUEST' | 'REGISTERED' | 'VIP',
      expertKey: body.expertKey,
    });

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create FastGPT embed session';
    const status =
      message === 'FastGPT knowledge panel is only available for patient workspace'
        ? 403
        : message === 'Requested FastGPT expert is not available'
          ? 404
          : 400;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
