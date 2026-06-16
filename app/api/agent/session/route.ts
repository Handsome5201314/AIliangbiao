import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { issueAgentSessionToken } from '@/lib/assessment-skill/auth';
import {
  getAgentToolCapabilities,
  resolveAgentChannel,
  resolveAgentSessionContext,
  resolveAgentTenantContext,
} from '@/lib/services/agent-session';
import {
  AiToyPartnerAuthError,
  assertAiToyDeviceBinding,
  assertAiToyPartnerToken,
  ensureAiToyDeviceBindingForDevice,
} from '@/lib/services/ai-toy-device-binding';

const requestSchema = z.object({
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
  entrypoint: z.enum(['app', 'agent']).optional(),
  clientKind: z.enum(['app', 'ai_toy']).optional(),
  channel: z.string().optional(),
  autoCreateBinding: z.boolean().optional(),
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
    const shouldAutoCreateAiToyBinding =
      body.clientKind === 'ai_toy' && body.autoCreateBinding === true;

    const context = shouldAutoCreateAiToyBinding
      ? await (async () => {
          assertAiToyPartnerToken(request.headers.get('authorization') || request.headers.get('Authorization'));
          const resolved = await ensureAiToyDeviceBindingForDevice({
            deviceId: body.deviceId,
            memberSnapshot: body.memberSnapshot,
          });
          if (body.memberId && body.memberId !== resolved.member.id) {
            throw new Error('AI toy device binding does not match this account member');
          }
          const tenant = await resolveAgentTenantContext({
            user: resolved.user,
            member: resolved.member,
            activeAccountType: resolved.activeAccountType,
          });
          return {
            ...resolved,
            ...tenant,
          };
        })()
      : await resolveAgentSessionContext({
          request,
          deviceId: body.deviceId,
          memberId: body.memberId,
          memberSnapshot: body.memberSnapshot,
        });

    const { user, member, profiles, activeAccountType } = context;
    if (body.clientKind === 'ai_toy' && !shouldAutoCreateAiToyBinding) {
      await assertAiToyDeviceBinding({
        deviceId: body.deviceId,
        userId: user.id,
        memberId: member.id,
      });
    }

    const agentChannel = resolveAgentChannel({
      channel: body.channel,
      clientKind: body.clientKind || 'app',
      entrypoint: body.entrypoint || 'app',
      accountType: activeAccountType || 'PATIENT',
    });

    const session = issueAgentSessionToken({
      userId: user.id,
      memberId: member.id,
      role: (user.role || 'GUEST') as 'GUEST' | 'REGISTERED' | 'VIP',
      deviceId: body.deviceId,
      accountType: activeAccountType || 'PATIENT',
      doctorProfileId: activeAccountType === 'DOCTOR' ? context.activeDoctorProfile?.id : undefined,
      organizationId: context.organization?.id || undefined,
      hermesProfileId: context.hermesProfile?.id || undefined,
      tenantRole: context.tenantRole,
      channel: agentChannel,
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
        tenant: {
          channel: agentChannel,
          tenantRole: context.tenantRole,
          organization: context.organization,
          hermesProfile: context.hermesProfile,
          activeDoctorProfile: context.activeDoctorProfile
            ? {
                id: context.activeDoctorProfile.id,
                realName: context.activeDoctorProfile.realName,
                organizationId: context.activeDoctorProfile.organizationId || null,
              }
            : null,
        },
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
    const status =
      error instanceof AiToyPartnerAuthError
        ? 401
        : error instanceof z.ZodError
          ? 400
          : 400;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to issue agent session' },
      { status }
    );
  }
}
