import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePatientUser } from "@/lib/auth/require-app-session";
import { markEducationDeliveryRead } from "@/lib/services/health-education";

const readSchema = z.object({
  confirmed: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deliveryId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { deliveryId } = await context.params;
    const payload = readSchema.parse(await request.json().catch(() => ({})));
    const delivery = await markEducationDeliveryRead({
      userId: user.id,
      deliveryId,
      confirmed: payload.confirmed,
    });

    return NextResponse.json({ delivery });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "健康教育阅读参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record education read" },
      { status: 401 }
    );
  }
}
