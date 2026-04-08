import { NextResponse } from "next/server";

import { buildAgentPitHealthPayload } from "@/lib/agentpit/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildAgentPitHealthPayload("ready"));
}

