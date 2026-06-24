import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import {
  createDefaultFollowUpTasks,
  listFollowUpTasks,
} from "@/lib/services/follow-up-tasks";

const createTasksSchema = z.object({
  baselineAssessmentHistoryId: z.string().trim().optional().nullable(),
  baselineAssessmentSessionId: z.string().trim().optional().nullable(),
  scaleId: z.string().trim().optional().nullable(),
  baselineAt: z.string().datetime().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId } = await context.params;
    const tasks = await listFollowUpTasks({
      doctorProfileId: doctorProfile.id,
      memberId,
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load follow-up tasks" },
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
    const payload = createTasksSchema.parse(await request.json());
    const tasks = await createDefaultFollowUpTasks({
      doctorProfileId: doctorProfile.id,
      memberId,
      ...payload,
    });

    return NextResponse.json({ tasks }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "随访任务参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create follow-up tasks" },
      { status: 401 }
    );
  }
}
