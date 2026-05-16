import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { submitClinicQrAssessment } from '@/lib/services/clinic-screenings';
import { getSerializableScaleById, isRespondentResultVisible, resolveScaleResultDeliveryMode } from '@/lib/scales/catalog';

const requestSchema = z.object({
  guestSessionId: z.string().min(1),
  respondentName: z.string().min(1),
  respondentGender: z.enum(['boy', 'girl']),
  respondentAgeMonths: z.number().int().nonnegative(),
  answers: z.array(z.number()),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = requestSchema.parse(await request.json());
    const result = await submitClinicQrAssessment({
      slug,
      ...body,
    });
    const scale = getSerializableScaleById(result.scale.id);
    const resultVisibleToRespondent = scale ? isRespondentResultVisible(scale) : true;
    const resultDeliveryMode = scale ? resolveScaleResultDeliveryMode(scale) : 'immediate';

    return NextResponse.json({
      success: true,
      screeningCode: result.screeningCode,
      resultDeliveryMode,
      resultVisibleToRespondent,
      result: resultVisibleToRespondent ? result.result : null,
      assessmentHistoryId: result.assessmentHistoryId,
      pointId: result.submission.pointId,
      doctorProfileId: result.submission.doctorProfileId,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit clinic assessment' },
      { status }
    );
  }
}
