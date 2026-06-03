import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { issueAgentSessionToken } from '@/lib/assessment-skill/auth';
import { getAgentToolCapabilities, resolveAgentSessionContext } from '@/lib/services/agent-session';
import { assertAiToyDeviceBinding } from '@/lib/services/ai-toy-device-binding';

const requestSchema = z.object({
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
  entrypoint: z.enum(['app', 'agent']).optional(),
  clientKind: z.enum(['app', 'ai_toy']).optional(),
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
    const { user, member, profiles, activeAccountType } = await resolveAgentSessionContext({
      request,
      deviceId: body.deviceId,
      memberId: body.memberId,
      memberSnapshot: body.memberSnapshot,
    });
    if (body.clientKind === 'ai_toy') {
      await assertAiToyDeviceBinding({
        deviceId: body.deviceId,
        userId: user.id,
        memberId: member.id,
      });
    }

    const session = issueAgentSessionToken({
      userId: user.id,
      memberId: member.id,
      role: (user.role || 'GUEST') as 'GUEST' | 'REGISTERED' | 'VIP',
      deviceId: body.deviceId,
      accountType: activeAccountType || 'PATIENT',
      doctorProfileId: user.doctorProfile?.id,
      entrypoint: body.entrypoint || 'app',
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      session: session.payload,
      account: {
        userId: user.id,
        role: user.role,
        accountType: activeAccountType || 'PATIENT',
        isAuthenticated: !user.isGuest,
        doctorProfile: user.doctorProfile
          ? {
              id: user.doctorProfile.id,
              realName: user.doctorProfile.realName,
              verificationStatus: user.doctorProfile.verificationStatus,
            }
          : null,
        availableTools: getAgentToolCapabilities({
          accountType: activeAccountType || 'PATIENT',
          doctorProfileId: user.doctorProfile?.id,
        }),
      },
      member: {
        id: member.id,
        nickname: member.nickname,
        relation: String(member.relation || 'SELF').toLowerCase(),
      },
      members: profiles.map((profile: any) => ({
        id: profile.id,
        nickname: profile.nickname,
        relation: String(profile.relation || 'SELF').toLowerCase(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to issue agent session' },
      { status: 400 }
    );
  }
}
