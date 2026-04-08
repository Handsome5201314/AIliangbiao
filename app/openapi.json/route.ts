import { NextResponse } from "next/server";

import { buildAgentPitOpenApiDocument } from "@/lib/agentpit/openapi";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildAgentPitOpenApiDocument());
}

