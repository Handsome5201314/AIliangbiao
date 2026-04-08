import { NextRequest, NextResponse } from "next/server";

import {
  getAgentPitClientId,
  getAgentPitOAuthBaseUrl,
  getAgentPitOAuthRedirectUri,
} from "@/lib/agentpit/config";
import {
  issueAgentPitOAuthState,
  normalizeAgentPitReturnTo,
} from "@/lib/agentpit/oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const deviceId = searchParams.get("deviceId")?.trim();

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    const returnTo = normalizeAgentPitReturnTo(searchParams.get("returnTo"));
    const authorizeUrl = new URL(
      "/api/oauth/authorize",
      getAgentPitOAuthBaseUrl()
    );

    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", getAgentPitClientId());
    authorizeUrl.searchParams.set(
      "redirect_uri",
      getAgentPitOAuthRedirectUri()
    );
    authorizeUrl.searchParams.set("scope", "openid profile email");
    authorizeUrl.searchParams.set(
      "state",
      issueAgentPitOAuthState({ deviceId, returnTo })
    );

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start AgentPit OAuth",
      },
      { status: 500 }
    );
  }
}

