import { NextRequest, NextResponse } from "next/server";

import { QuotaManager } from "@/lib/auth/quotaManager";
import {
  getAgentPitClientId,
  getAgentPitClientSecret,
  getAgentPitOAuthBaseUrl,
  getAgentPitOAuthRedirectUri,
  getAgentPitPublicBaseUrl,
} from "@/lib/agentpit/config";
import { verifyAgentPitOAuthState } from "@/lib/agentpit/oauth-state";

type AgentPitTokenResponse = {
  access_token: string;
  token_type?: string;
};

type AgentPitUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  image?: string;
};

function buildCallbackRedirect(
  returnTo: string,
  status: "success" | "error",
  reason?: string
) {
  const redirectUrl = new URL(returnTo, getAgentPitPublicBaseUrl());
  redirectUrl.searchParams.set("oauth", status);

  if (reason) {
    redirectUrl.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(redirectUrl);
}

async function exchangeCodeForAccessToken(code: string) {
  const tokenUrl = new URL("/api/oauth/token", getAgentPitOAuthBaseUrl());
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: getAgentPitClientId(),
    client_secret: getAgentPitClientSecret(),
    redirect_uri: getAgentPitOAuthRedirectUri(),
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `AgentPit token exchange failed: ${response.status} ${details}`
    );
  }

  const payload = (await response.json()) as AgentPitTokenResponse;
  if (!payload.access_token) {
    throw new Error("AgentPit token response did not include access_token");
  }

  return payload.access_token;
}

async function fetchAgentPitUserInfo(accessToken: string) {
  const userInfoUrl = new URL("/api/oauth/userinfo", getAgentPitOAuthBaseUrl());
  const response = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `AgentPit userinfo request failed: ${response.status} ${details}`
    );
  }

  return (await response.json()) as AgentPitUserInfo;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let returnTo = "/agent";

  try {
    const rawState = request.nextUrl.searchParams.get("state");
    if (!rawState) {
      return NextResponse.json(
        { error: "Missing OAuth state" },
        { status: 400 }
      );
    }

    const state = verifyAgentPitOAuthState(rawState);
    returnTo = state.returnTo;

    const oauthError = request.nextUrl.searchParams.get("error");
    if (oauthError) {
      return buildCallbackRedirect(returnTo, "error", oauthError);
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return buildCallbackRedirect(returnTo, "error", "missing_code");
    }

    const accessToken = await exchangeCodeForAccessToken(code);
    const userInfo = await fetchAgentPitUserInfo(accessToken);

    if (!userInfo.email) {
      return buildCallbackRedirect(returnTo, "error", "missing_email");
    }

    await QuotaManager.upgradeToRegisteredUser(
      state.deviceId,
      undefined,
      userInfo.email
    );

    return buildCallbackRedirect(returnTo, "success");
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "agentpit_oauth_failed";

    return buildCallbackRedirect(returnTo, "error", reason);
  }
}
