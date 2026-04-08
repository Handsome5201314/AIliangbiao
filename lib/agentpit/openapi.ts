import { getAgentPitPublicBaseUrl, getAgentPitWebUrl } from "./config";

function buildErrorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
          required: ["error"],
        },
      },
    },
  };
}

export function buildAgentPitOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "AIliangbiao Scale Agent API",
      version: "1.0.0",
      description:
        "Public AgentPit-facing API for listing scales, deterministic evaluation, and conversation-to-answer analysis.",
    },
    servers: [
      {
        url: getAgentPitPublicBaseUrl(),
      },
    ],
    tags: [
      {
        name: "Scales",
        description: "Scale catalog, scoring, and conversation analysis",
      },
    ],
    externalDocs: {
      description: "Online experience entry",
      url: getAgentPitWebUrl(),
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API key",
        },
      },
      schemas: {
        Message: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["user", "assistant"],
            },
            content: {
              type: "string",
            },
            timestamp: {
              type: "string",
            },
          },
          required: ["role", "content"],
        },
        EvaluateRequest: {
          type: "object",
          properties: {
            answers: {
              type: "array",
              items: { type: "number" },
            },
          },
          required: ["answers"],
        },
        AnalyzeConversationRequest: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              items: { $ref: "#/components/schemas/Message" },
            },
          },
          required: ["messages"],
        },
      },
    },
    paths: {
      "/healthz": {
        get: {
          summary: "Health check",
          responses: {
            "200": {
              description: "Service is healthy",
            },
          },
        },
      },
      "/v1/scales": {
        get: {
          summary: "List scales",
          tags: ["Scales"],
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Available scale list",
            },
            "401": buildErrorResponse("Missing Bearer token"),
            "403": buildErrorResponse("Invalid Bearer token"),
          },
        },
      },
      "/v1/scales/{scaleId}": {
        get: {
          summary: "Get scale detail",
          tags: ["Scales"],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "scaleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Scale detail",
            },
            "401": buildErrorResponse("Missing Bearer token"),
            "403": buildErrorResponse("Invalid Bearer token"),
            "404": buildErrorResponse("Scale not found"),
          },
        },
      },
      "/v1/scales/{scaleId}/evaluate": {
        post: {
          summary: "Evaluate scale answers",
          tags: ["Scales"],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "scaleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EvaluateRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Deterministic scoring result",
            },
            "400": buildErrorResponse("Invalid payload"),
            "401": buildErrorResponse("Missing Bearer token"),
            "403": buildErrorResponse("Invalid Bearer token"),
            "404": buildErrorResponse("Scale not found"),
          },
        },
      },
      "/v1/scales/{scaleId}/analyze-conversation": {
        post: {
          summary: "Draft answers from conversation history",
          tags: ["Scales"],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "scaleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AnalyzeConversationRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Conversation analysis result",
            },
            "400": buildErrorResponse("Invalid payload"),
            "401": buildErrorResponse("Missing Bearer token"),
            "403": buildErrorResponse("Invalid Bearer token"),
            "404": buildErrorResponse("Scale not found"),
            "500": buildErrorResponse("Analysis failed"),
          },
        },
      },
    },
  };
}

