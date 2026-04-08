const DEFAULT_AGENTPIT_PUBLIC_BASE_URL = "https://ailiangbiao.agentpit.io";
const DEFAULT_AGENTPIT_OAUTH_BASE_URL = "https://api.agentpit.io";
const DEFAULT_AGENTPIT_SHARED_BEARER = "local-dev-agentpit-bearer";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function requireEnv(name: string, value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is not configured`);
  }

  return normalized;
}

export function getAgentPitPublicBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return trimTrailingSlash(
    env.AGENTPIT_PUBLIC_BASE_URL || DEFAULT_AGENTPIT_PUBLIC_BASE_URL
  );
}

export function getAgentPitWebUrl(env: NodeJS.ProcessEnv = process.env) {
  return `${getAgentPitPublicBaseUrl(env)}/agent`;
}

export function getAgentPitOAuthBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return trimTrailingSlash(
    env.AGENTPIT_OAUTH_BASE_URL || DEFAULT_AGENTPIT_OAUTH_BASE_URL
  );
}

export function getAgentPitOAuthRedirectUri(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.AGENTPIT_OAUTH_REDIRECT_URI ||
    `${getAgentPitPublicBaseUrl(env)}/api/agentpit/oauth/callback`
  );
}

export function getAgentPitSharedBearer(env: NodeJS.ProcessEnv = process.env) {
  const configuredValue = env.AGENTPIT_SHARED_BEARER?.trim();
  if (configuredValue) {
    return configuredValue;
  }

  const sessionSecretFallback = env.SESSION_SECRET?.trim();
  if (sessionSecretFallback) {
    return sessionSecretFallback;
  }

  if (env.NODE_ENV !== "production") {
    return DEFAULT_AGENTPIT_SHARED_BEARER;
  }

  throw new Error("AGENTPIT_SHARED_BEARER is not configured");
}

export function getAgentPitClientId(env: NodeJS.ProcessEnv = process.env) {
  return requireEnv("AGENTPIT_CLIENT_ID", env.AGENTPIT_CLIENT_ID);
}

export function getAgentPitClientSecret(env: NodeJS.ProcessEnv = process.env) {
  return requireEnv("AGENTPIT_CLIENT_SECRET", env.AGENTPIT_CLIENT_SECRET);
}
