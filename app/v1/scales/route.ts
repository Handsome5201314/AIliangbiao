import { NextResponse } from "next/server";

import { buildAgentPitAuthErrorResponse, assertAgentPitSharedBearer } from "@/lib/agentpit/shared-auth";
import { listSkillScales } from "@/lib/assessment-skill/scale-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAgentPitSharedBearer(request);

    return NextResponse.json({
      scales: listSkillScales(),
    });
  } catch (error) {
    const authResponse = buildAgentPitAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list scales",
      },
      { status: 500 }
    );
  }
}
