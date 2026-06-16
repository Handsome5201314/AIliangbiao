import { getHermesApiConfig } from "@/lib/realtime/hermes";

export type HermesHealthSnapshot = {
  status: "ok" | "degraded";
  provider: "hermes";
  configured: boolean;
  checkedAt: string;
  upstream: {
    url: string;
    status: number;
    body?: unknown;
  };
  reason?: string;
};

function buildHermesHealthUrl(endpoint: string) {
  const url = new URL(endpoint);
  url.pathname = "/health";
  url.search = "";
  return url.toString();
}

export async function getHermesHealthSnapshot(): Promise<HermesHealthSnapshot> {
  const config = getHermesApiConfig();

  if (!config.enabled) {
    return {
      status: "degraded",
      provider: "hermes",
      configured: false,
      checkedAt: new Date().toISOString(),
      upstream: {
        url: "",
        status: 0,
      },
      reason: "Hermes API server is not configured",
    };
  }

  const healthUrl = buildHermesHealthUrl(config.endpoint);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    return {
      status: response.ok ? "ok" : "degraded",
      provider: "hermes",
      configured: true,
      checkedAt: new Date().toISOString(),
      upstream: {
        url: healthUrl,
        status: response.status,
        body: payload,
      },
    };
  } catch (error) {
    return {
      status: "degraded",
      provider: "hermes",
      configured: true,
      checkedAt: new Date().toISOString(),
      upstream: {
        url: healthUrl,
        status: 0,
      },
      reason: error instanceof Error ? error.message : "Hermes health check failed",
    };
  }
}
