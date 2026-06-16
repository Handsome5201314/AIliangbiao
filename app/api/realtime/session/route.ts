import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildRealtimeSessionBootstrap } from "@/lib/realtime/session";

const requestSchema = z.object({
  surface: z.enum(["agent", "doctor_bot"]),
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
  doctorBotSlug: z.string().optional(),
  channel: z.string().optional(),
  memberSnapshot: z
    .object({
      nickname: z.string().optional(),
      gender: z.string().optional(),
      ageMonths: z.number().optional(),
      relation: z.string().optional(),
      languagePreference: z.string().optional(),
      interests: z.array(z.string()).optional(),
      fears: z.array(z.string()).optional(),
      avatarConfig: z.unknown().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());

    if (body.surface === "doctor_bot" && !body.doctorBotSlug) {
      return NextResponse.json(
        { error: "doctorBotSlug is required for doctor_bot surface" },
        { status: 400 }
      );
    }

    const bootstrap = await buildRealtimeSessionBootstrap({
      request,
      surface: body.surface,
      deviceId: body.deviceId,
      memberId: body.memberId,
      doctorBotSlug: body.doctorBotSlug,
      channel: body.channel,
      memberSnapshot: body.memberSnapshot,
    });

    return NextResponse.json(bootstrap);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create realtime session" },
      { status }
    );
  }
}
