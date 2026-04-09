import { NextResponse } from "next/server";

import { buildAgentPitAuthErrorResponse, assertAgentPitSharedBearer } from "@/lib/agentpit/shared-auth";
import { listSkillScaleSummaries, listSkillScales } from "@/lib/assessment-skill/scale-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAgentPitSharedBearer(request);
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "summary") {
      return NextResponse.json({
        scales: listSkillScaleSummaries(),
      });
    }

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
