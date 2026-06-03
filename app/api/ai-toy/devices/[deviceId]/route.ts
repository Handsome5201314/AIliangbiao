import { NextRequest, NextResponse } from "next/server";

import { requirePatientUser } from "@/lib/auth/require-app-session";
import { resolveAiToyDeviceBinding, unbindAiToyDevice } from "@/lib/services/ai-toy-device-binding";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { deviceId } = await context.params;
    const binding = await resolveAiToyDeviceBinding(deviceId);

    if (!binding || binding.userId !== user.id || binding.status !== "ACTIVE") {
      return NextResponse.json({ error: "AI toy device binding not found" }, { status: 404 });
    }

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load AI toy device binding" },
      { status: 401 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { deviceId } = await context.params;
    const binding = await unbindAiToyDevice({
      deviceId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      binding: {
        id: binding.id,
        deviceId: binding.deviceId,
        userId: binding.userId,
        memberId: binding.memberProfileId,
        status: binding.status,
        unboundAt: binding.unboundAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unbind AI toy device" },
      { status: 401 }
    );
  }
}
