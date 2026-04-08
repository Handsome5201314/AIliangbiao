import { NextResponse } from "next/server";

import { buildAgentPitScaleManifest } from "@/lib/agentpit/manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildAgentPitScaleManifest());
}

