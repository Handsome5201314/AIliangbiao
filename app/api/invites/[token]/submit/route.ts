import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { submitDoctorScaleInvite } from '@/lib/services/doctor-invites';
import { getSerializableScaleById, resolveScaleResultDeliveryMode } from '@/lib/scales/catalog';

const requestSchema = z.object({
  deviceId: z.string().min(1),
  realName: z.string().min(1),
  contactPhone: z.string().min(1),
  gender: z.string().min(1),
  ageMonths: z.number().int().nonnegative(),
  nickname: z.string().optional(),
  answers: z.array(z.number()),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await submitDoctorScaleInvite({
      token,
      deviceId: body.deviceId,
      identity: {
        realName: body.realName,
        contactPhone: body.contactPhone,
        gender: body.gender,
        ageMonths: body.ageMonths,
        nickname: body.nickname,
      },
      answers: body.answers,
    });
    const scale = getSerializableScaleById(result.invite.scaleId);
    const resultDeliveryMode = scale ? resolveScaleResultDeliveryMode(scale) : 'immediate';

    return NextResponse.json({
      success: true,
      ...result,
      resultDeliveryMode,
      resultVisibleToRespondent: false,
      result: null,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交失败' },
      { status }
    );
  }
}
