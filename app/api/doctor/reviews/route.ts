import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  ensurePendingDoctorReviewForAssessment,
  listDoctorReviews,
} from '@/lib/services/doctor-care';

const createReviewSchema = z.object({
  assessmentHistoryId: z.string().min(1),
  assessmentSessionId: z.string().min(1).optional(),
  memberProfileId: z.string().min(1).optional(),
});

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  return 401;
}

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const status = request.nextUrl.searchParams.get('status') || 'PENDING';
    const reviews = await listDoctorReviews({
      doctorProfileId: doctorProfile.id,
      status: status as Parameters<typeof listDoctorReviews>[0]['status'],
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const body = createReviewSchema.parse(await request.json());
    const review = await ensurePendingDoctorReviewForAssessment({
      assessmentHistoryId: body.assessmentHistoryId,
      assessmentSessionId: body.assessmentSessionId,
      memberProfileId: body.memberProfileId,
      doctorProfileId: doctorProfile.id,
    });

    if (!review) {
      return NextResponse.json(
        { error: '该评估不需要医生复核或缺少可复核的患者档案' },
        { status: 400 }
      );
    }

    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create doctor review' },
      { status: errorStatus(error) }
    );
  }
}
