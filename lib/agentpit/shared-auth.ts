import { NextResponse } from "next/server";

import { getAgentPitSharedBearer } from "./config";

export class AgentPitAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function extractBearerToken(headers: Headers) {
  const authHeader =
    headers.get("authorization") || headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export function assertAgentPitSharedBearer(request: Request | { headers: Headers }) {
  const token = extractBearerToken(request.headers);
  if (!token) {
    throw new AgentPitAuthError("Missing Bearer token", 401);
  }

  if (token !== getAgentPitSharedBearer()) {
    throw new AgentPitAuthError("Invalid Bearer token", 403);
  }
}

export function buildAgentPitAuthErrorResponse(error: unknown) {
  if (!(error instanceof AgentPitAuthError)) {
    return null;
  }

  return NextResponse.json(
    { error: error.message },
    { status: error.status }
  );
}

