import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { completeDoctorReview } from '@/lib/services/doctor-care';

const completeReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_MORE_INFO']),
  reviewConclusion: z.string().trim().optional(),
  reviewNotes: z.string().trim().optional(),
  allowParentVisible: z.boolean().optional(),
});

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof Error && /备注/.test(error.message)) return 400;
  return 401;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { reviewId } = await context.params;
    const body = completeReviewSchema.parse(await request.json());
    const review = await completeDoctorReview({
      doctorProfileId: doctorProfile.id,
      reviewId,
      status: body.status,
      reviewConclusion: body.reviewConclusion,
      reviewNotes: body.reviewNotes,
      allowParentVisible: body.allowParentVisible,
    });

    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete doctor review' },
      { status: errorStatus(error) }
    );
  }
}
