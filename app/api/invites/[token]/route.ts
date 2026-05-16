import { NextRequest, NextResponse } from 'next/server';

import { getDoctorScaleInviteForPublic } from '@/lib/services/doctor-invites';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const { invite, scale } = await getDoctorScaleInviteForPublic(token);

    return NextResponse.json({
      invite: {
        id: invite.id,
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        usedAt: invite.usedAt,
        doctor: {
          id: invite.doctorProfile.id,
          realName: invite.doctorProfile.realName,
          hospitalName: invite.doctorProfile.hospitalName,
          departmentName: invite.doctorProfile.departmentName,
          title: invite.doctorProfile.title,
        },
        linkedMember: invite.linkedMember
          ? {
              id: invite.linkedMember.id,
              nickname: invite.linkedMember.nickname,
              realName: invite.linkedMember.realName,
              contactPhone: invite.linkedMember.contactPhone,
            }
          : null,
      },
      scale,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invite not found' },
      { status: 404 }
    );
  }
}
