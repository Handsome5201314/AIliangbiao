import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePatientUser } from "@/lib/auth/require-app-session";
import { bindAiToyDevice } from "@/lib/services/ai-toy-device-binding";

const bindSchema = z.object({
  deviceId: z.string().trim().min(1),
  memberId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requirePatientUser(request);
    const body = bindSchema.parse(await request.json());
    const binding = await bindAiToyDevice({
      deviceId: body.deviceId,
      userId: user.id,
      memberProfileId: body.memberId,
    });

    return NextResponse.json({
      success: true,
      binding: {
        id: binding.id,
        deviceId: binding.deviceId,
        userId: binding.userId,
        memberId: binding.memberProfileId,
        status: binding.status,
        boundAt: binding.boundAt,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.flatten() : error instanceof Error ? error.message : "Failed to bind AI toy device" },
      { status }
    );
  }
}
