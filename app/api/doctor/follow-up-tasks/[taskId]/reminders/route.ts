import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import { recordManualReminder } from "@/lib/services/follow-up-tasks";

const reminderSchema = z.object({
  reminderChannel: z.enum(["MANUAL_PHONE", "MANUAL_WECHAT", "IN_PERSON", "OTHER"]).default("MANUAL_PHONE"),
  status: z.enum(["RECORDED", "ACKNOWLEDGED", "FAILED"]).default("RECORDED"),
  messageSummary: z.string().trim().max(500, "提醒摘要不能超过 500 个字符").optional().nullable(),
  metadata: z.unknown().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { taskId } = await context.params;
    const payload = reminderSchema.parse(await request.json());
    const reminder = await recordManualReminder({
      doctorProfileId: doctorProfile.id,
      followUpTaskId: taskId,
      reminderChannel: payload.reminderChannel,
      status: payload.status,
      messageSummary: payload.messageSummary,
      metadata: payload.metadata,
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "提醒记录参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record reminder" },
      { status: 401 }
    );
  }
}
