import { NextResponse } from "next/server";

import { buildAgentPitAuthErrorResponse, assertAgentPitSharedBearer } from "@/lib/agentpit/shared-auth";
import { getSkillScale } from "@/lib/assessment-skill/scale-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    assertAgentPitSharedBearer(request);

    const { scaleId } = await context.params;
    const scale = getSkillScale(scaleId);

    if (!scale) {
      return NextResponse.json(
        { error: "Scale not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ scale });
  } catch (error) {
    const authResponse = buildAgentPitAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load scale detail",
      },
      { status: 500 }
    );
  }
}
