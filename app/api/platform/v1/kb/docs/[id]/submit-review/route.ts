import { NextRequest, NextResponse } from "next/server";

import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import { submitPlatformKnowledgeDocForReview, type PlatformKnowledgeDocActor } from "@/lib/services/platform-kb-docs";

async function resolveDoctorKnowledgeDocActor(request: NextRequest): Promise<PlatformKnowledgeDocActor> {
  const { user, doctorProfile } = await requireApprovedDoctorUser(request);
  return {
    kind: "doctor",
    userId: user.id,
    doctorProfileId: doctorProfile.id,
    organizationId: doctorProfile.organizationId || null,
    isOrganizationOwner: doctorProfile.isOrganizationOwner,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveDoctorKnowledgeDocActor(request);
    const { id } = await context.params;
    const doc = await submitPlatformKnowledgeDocForReview({
      actor,
      knowledgeDocId: id,
    });

    return NextResponse.json({
      doc,
      message: "知识文档已提交审核",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit knowledge doc";
    const status =
      message.includes("Unauthorized") ||
      message.includes("Missing Bearer token") ||
      message.includes("Doctor") ||
      message.includes("not approved")
        ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
