import type { ScaleDefinition } from "@/lib/schemas/core/types";

type HermesApiConfig = {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
};

type HermesAssessmentSuggestion = {
  scaleId: string;
  reason: string;
  cardTitle?: string;
  cardBody?: string;
};

type HermesDoctorBotReply = {
  text: string;
  assessment: HermesAssessmentSuggestion | null;
};

type HermesResponsesApiOutputItem = {
  type?: string;
  role?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  text?: string;
};

type HermesResponsesApiResponse = {
  output?: HermesResponsesApiOutputItem[];
  error?: {
    message?: string;
  };
};

function normalizeResponsesEndpoint(baseUrl: string) {
  const url = new URL(baseUrl.trim());
  if (url.pathname.endsWith("/responses")) {
    return url.toString();
  }
  if (url.pathname.endsWith("/v1")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/responses`;
    return url.toString();
  }
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/v1/responses";
    return url.toString();
  }

  url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/responses`;
  return url.toString();
}

export function getHermesApiConfig(): HermesApiConfig {
  const baseUrl = process.env.HERMES_API_SERVER_BASE_URL?.trim() || "";
  const apiKey = process.env.HERMES_API_SERVER_KEY?.trim() || "";
  const model = process.env.HERMES_API_SERVER_MODEL?.trim() || "hermes-agent";

  if (!baseUrl || !apiKey) {
    return {
      enabled: false,
      endpoint: "",
      apiKey: "",
      model,
    };
  }

  return {
    enabled: true,
    endpoint: normalizeResponsesEndpoint(baseUrl),
    apiKey,
    model,
  };
}

function buildDoctorBotInstructions(input: {
  assistantName: string;
  enabledScales: ScaleDefinition[];
}) {
  const scaleLines = input.enabledScales
    .map((scale) => `- ${scale.id}`)
    .join("\n");

  return [
    `You are ${input.assistantName}, a warm doctor-assistant conversation backend.`,
    "Return JSON only. No markdown.",
    'Use this schema: {"text":"string","assessment":{"scaleId":"string","reason":"string","cardTitle":"string","cardBody":"string"}|null}',
    "If no structured assessment should be suggested yet, set assessment to null.",
    "Only use a scaleId from the allowed list below.",
    "Be brief, natural, and patient-friendly.",
    "Allowed scales:",
    scaleLines || "- NONE",
  ].join("\n");
}

export function extractTextFromOutput(output: HermesResponsesApiOutputItem[] = []) {
  for (const item of output) {
    if (item.type === "message" && item.role === "assistant" && Array.isArray(item.content)) {
      const text = item.content
        .filter((part) => part.type === "output_text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("")
        .trim();
      if (text) {
        return text;
      }
    }

    if (typeof item.text === "string" && item.text.trim()) {
      return item.text.trim();
    }
  }

  return "";
}

function tryParseJsonObject(rawText: string) {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore parse error
  }

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore parse error
    }
  }

  return null;
}

export async function requestHermesDoctorBotReply(input: {
  assistantName: string;
  conversationId: string;
  content: string;
  enabledScales: ScaleDefinition[];
}) {
  const config = getHermesApiConfig();
  if (!config.enabled) {
    throw new Error("Hermes API server is not configured");
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: input.content,
      instructions: buildDoctorBotInstructions({
        assistantName: input.assistantName,
        enabledScales: input.enabledScales,
      }),
      conversation: input.conversationId,
      store: true,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as HermesResponsesApiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Hermes request failed: ${response.status}`);
  }

  const rawText = extractTextFromOutput(payload.output || []);
  if (!rawText) {
    throw new Error("Hermes returned an empty response");
  }

  const parsed = tryParseJsonObject(rawText);
  if (!parsed) {
    return {
      text: rawText,
      assessment: null,
    } satisfies HermesDoctorBotReply;
  }

  return {
    text: typeof parsed.text === "string" ? parsed.text : rawText,
    assessment:
      parsed.assessment &&
      typeof parsed.assessment === "object" &&
      typeof (parsed.assessment as Record<string, unknown>).scaleId === "string" &&
      typeof (parsed.assessment as Record<string, unknown>).reason === "string"
        ? {
            scaleId: String((parsed.assessment as Record<string, unknown>).scaleId),
            reason: String((parsed.assessment as Record<string, unknown>).reason),
            cardTitle:
              typeof (parsed.assessment as Record<string, unknown>).cardTitle === "string"
                ? String((parsed.assessment as Record<string, unknown>).cardTitle)
                : undefined,
            cardBody:
              typeof (parsed.assessment as Record<string, unknown>).cardBody === "string"
                ? String((parsed.assessment as Record<string, unknown>).cardBody)
                : undefined,
          }
        : null,
  } satisfies HermesDoctorBotReply;
}
