import { NextRequest, NextResponse } from "next/server";

import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import { submitEducationContentForReview } from "@/lib/services/health-education";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { contentId } = await context.params;
    const content = await submitEducationContentForReview({
      doctorProfileId: doctorProfile.id,
      educationContentId: contentId,
    });

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit education content" },
      { status: 401 }
    );
  }
}
