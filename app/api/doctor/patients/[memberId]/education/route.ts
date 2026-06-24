import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import {
  createEducationDeliveriesForApprovedReport,
  listDoctorPatientEducationDeliveries,
} from "@/lib/services/health-education";

const deliverySchema = z.object({
  assessmentReportId: z.string().trim().optional().nullable(),
  assessmentHistoryId: z.string().trim().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const deliveries = await listDoctorPatientEducationDeliveries({
      doctorProfileId: doctorProfile.id,
      memberId,
    });

    return NextResponse.json({ deliveries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load education deliveries" },
      { status: 401 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const payload = deliverySchema.parse(await request.json());

    if (!payload.assessmentReportId && !payload.assessmentHistoryId) {
      return NextResponse.json({ error: "缺少正式报告或评估记录 ID" }, { status: 400 });
    }

    const result = await createEducationDeliveriesForApprovedReport({
      doctorProfileId: doctorProfile.id,
      memberId,
      assessmentReportId: payload.assessmentReportId,
      assessmentHistoryId: payload.assessmentHistoryId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "健康教育触达参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to deliver education content" },
      { status: 401 }
    );
  }
}
