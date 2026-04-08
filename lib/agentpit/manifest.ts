import { getAgentPitPublicBaseUrl } from "./config";

export function buildAgentPitScaleManifest() {
  const baseUrl = getAgentPitPublicBaseUrl();

  return {
    server: {
      name: "ailiangbiao-scale-agent",
      version: "1.0.0",
      description:
        "Public scale assessment MCP facade for AgentPit-compatible integrations.",
      url: `${baseUrl}/api/mcp/scale`,
    },
    authentication: {
      type: "bearer",
      header: "Authorization",
    },
    tools: [
      {
        name: "list_scales",
        description: "List the available scales exposed by the public scale agent.",
      },
      {
        name: "get_scale_questions",
        description: "Return the question set for a specific scale.",
      },
      {
        name: "submit_assessment",
        description:
          "Evaluate ordered answers with the deterministic scoring engine.",
      },
    ],
  };
}

