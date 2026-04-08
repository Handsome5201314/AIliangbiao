export function buildAgentPitHealthPayload(status: "ok" | "ready" = "ok") {
  return {
    status,
    service: "ailiangbiao-scale-agent",
    version: "0.1.0",
  };
}

