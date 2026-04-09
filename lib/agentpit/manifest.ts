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
      {
        name: "start_assessment_session",
        description: "Start a step-by-step assessment session for a scale.",
      },
      {
        name: "get_current_question",
        description: "Read the current question and progress for an assessment session.",
      },
      {
        name: "submit_answer",
        description: "Submit one answer to the current assessment session question.",
      },
      {
        name: "get_assessment_result",
        description: "Fetch the final result for a completed assessment session.",
      },
    ],
  };
}
