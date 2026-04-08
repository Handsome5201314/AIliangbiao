import crypto from "node:crypto";

type AgentPitOAuthStatePayload = {
  deviceId: string;
  returnTo: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function getAgentPitStateSecret() {
  return (
    process.env.AGENTPIT_STATE_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.AGENT_SESSION_SECRET ||
    "local-dev-agentpit-state-secret"
  );
}

function signStatePayload(encodedPayload: string) {
  return base64UrlEncode(
    crypto
      .createHmac("sha256", getAgentPitStateSecret())
      .update(encodedPayload)
      .digest()
  );
}

export function normalizeAgentPitReturnTo(returnTo: string | null | undefined) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/agent";
  }

  return returnTo;
}

export function issueAgentPitOAuthState(input: {
  deviceId: string;
  returnTo?: string | null;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AgentPitOAuthStatePayload = {
    deviceId: input.deviceId,
    returnTo: normalizeAgentPitReturnTo(input.returnTo),
    iat: now,
    exp: now + (input.ttlSeconds ?? 60 * 10),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signStatePayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAgentPitOAuthState(state: string): AgentPitOAuthStatePayload {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("Invalid OAuth state");
  }

  const expectedSignature = signStatePayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const payload = JSON.parse(
    base64UrlDecode(encodedPayload)
  ) as AgentPitOAuthStatePayload;

  if (!payload.deviceId) {
    throw new Error("OAuth state is missing deviceId");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error("OAuth state expired");
  }

  return {
    ...payload,
    returnTo: normalizeAgentPitReturnTo(payload.returnTo),
  };
}

