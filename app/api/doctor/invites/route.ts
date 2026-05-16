import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { createDoctorScaleInvite, getDoctorScaleInvites } from '@/lib/services/doctor-invites';

const createInviteSchema = z.object({
  scaleId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const invites = await getDoctorScaleInvites(doctorProfile.id);

    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        token: invite.token,
        scaleId: invite.scaleId,
        status: invite.status,
        expiresAt: invite.expiresAt,
        usedAt: invite.usedAt,
        createdAt: invite.createdAt,
        linkedMember: invite.linkedMember
          ? {
              id: invite.linkedMember.id,
              nickname: invite.linkedMember.nickname,
              realName: invite.linkedMember.realName,
              contactPhone: invite.linkedMember.contactPhone,
            }
          : null,
        scale: invite.scale
          ? {
              id: invite.scale.id,
              title: invite.scale.title,
            }
          : null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const body = createInviteSchema.parse(await request.json());
    const invite = await createDoctorScaleInvite({
      doctorProfileId: doctorProfile.id,
      scaleId: body.scaleId,
    });

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        scaleId: invite.scaleId,
        scaleTitle: invite.scale.title,
        expiresAt: invite.expiresAt,
        status: invite.status,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invite' },
      { status }
    );
  }
}
