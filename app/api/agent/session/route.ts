import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { issueAgentSessionToken } from '@/lib/assessment-skill/auth';
import { ensureMemberForDevice } from '@/lib/assessment-skill/member-service';

const requestSchema = z.object({
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
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
    const body = requestSchema.parse(await request.json());
    const { user, member } = await ensureMemberForDevice(body);

    const session = issueAgentSessionToken({
      userId: user.id,
      memberId: member.id,
      role: (user.role || 'GUEST') as 'GUEST' | 'REGISTERED' | 'VIP',
      deviceId: body.deviceId,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      session: session.payload,
      member: {
        id: member.id,
        nickname: member.nickname,
        relation: String(member.relation || 'SELF').toLowerCase(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to issue agent session' },
      { status: 400 }
    );
  }
}
