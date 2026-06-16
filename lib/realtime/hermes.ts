import type { LanguageCode, ScaleDefinition } from "@/lib/schemas/core/types";
import { TRIAGE_SYSTEM_PROMPT, parseAIResponse, type TriageAIResponse } from "@/lib/services/triageFlow";

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

type HermesAgentReply = {
  rawText: string;
  aiResponse: TriageAIResponse;
};

type HermesAgentTenantContext = {
  channel?: string;
  tenantRole?: string;
  organizationId?: string;
  doctorProfileId?: string;
  hermesProfileId?: string;
  organizationName?: string;
  doctorName?: string;
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

type HermesSseMessage = {
  event: string;
  data: unknown;
};

function formatAgentTenantContext(input?: HermesAgentTenantContext) {
  if (!input) {
    return "当前租户上下文未知";
  }

  return [
    `channel: ${input.channel || "unknown"}`,
    `tenant_role: ${input.tenantRole || "unknown"}`,
    input.organizationName || input.organizationId
      ? `organization: ${input.organizationName || input.organizationId}`
      : null,
    input.doctorName || input.doctorProfileId
      ? `active_doctor: ${input.doctorName || input.doctorProfileId}`
      : null,
    input.hermesProfileId ? `hermes_profile_id: ${input.hermesProfileId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

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

function buildAgentTriageInstructions(input: {
  language: LanguageCode;
  tenantContext?: HermesAgentTenantContext;
}) {
  return [
    TRIAGE_SYSTEM_PROMPT,
    "",
    "补充约束：",
    `- 当前语言：${input.language}`,
    "- 你收到的是平台后端整理过的受限上下文，只能基于当前成员与当前租户作答。",
    "- 不得引用其他成员、其他机构或未提供的历史信息。",
    "- 如果上下文已能支持推荐量表，就直接进入 recommend_scale。",
    "- 如果用户已经明确同意开始已有推荐量表，就进入 start_scale。",
    "",
    "当前租户上下文：",
    formatAgentTenantContext(input.tenantContext),
    "",
    "请严格只返回 JSON 对象，不要输出 Markdown，不要输出代码块。",
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

function parseHermesSseBuffer(buffer: string) {
  const blocks = buffer.split(/\n\n/);
  const rest = buffer.endsWith("\n\n") ? "" : blocks.pop() || "";
  const messages: HermesSseMessage[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    let event = "message";
    const dataLines: string[] = [];

    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim() || event;
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }

    const rawData = dataLines.join("\n");
    if (!rawData) {
      messages.push({ event, data: null });
      continue;
    }

    if (rawData === "[DONE]") {
      messages.push({ event, data: rawData });
      continue;
    }

    try {
      messages.push({ event, data: JSON.parse(rawData) });
    } catch {
      messages.push({ event, data: rawData });
    }
  }

  return { messages, rest };
}

function extractHermesStreamDelta(message: HermesSseMessage) {
  if (typeof message.data === "string") {
    return message.event.includes("output_text") ? message.data : "";
  }

  if (!message.data || typeof message.data !== "object" || Array.isArray(message.data)) {
    return "";
  }

  const payload = message.data as Record<string, unknown>;
  if (typeof payload.delta === "string") {
    return payload.delta;
  }

  if (typeof payload.text === "string" && message.event.includes("output_text")) {
    return payload.text;
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

async function requestHermesResponseText(input: {
  conversationId: string;
  content: string;
  instructions: string;
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
      instructions: input.instructions,
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

  return rawText;
}

async function requestHermesStreamText(input: {
  conversationId: string;
  content: string;
  instructions: string;
  onDelta?: ((delta: string) => void | Promise<void>) | undefined;
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
      instructions: input.instructions,
      conversation: input.conversationId,
      store: true,
      stream: true,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as HermesResponsesApiResponse;
    throw new Error(payload.error?.message || `Hermes request failed: ${response.status}`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (!/text\/event-stream/i.test(contentType)) {
    const payload = (await response.json().catch(() => ({}))) as HermesResponsesApiResponse;
    const rawText = extractTextFromOutput(payload.output || []);
    if (!rawText) {
      throw new Error("Hermes returned an empty response");
    }
    if (input.onDelta) {
      await input.onDelta(rawText);
    }
    return rawText;
  }

  if (!response.body) {
    throw new Error("Hermes stream body is missing");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let rawText = "";
  let emittedSnapshot = false;
  let completedPayload: HermesResponsesApiResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const parsed = parseHermesSseBuffer(buffer);
    buffer = parsed.rest;

    for (const message of parsed.messages) {
      if (message.data === "[DONE]") {
        continue;
      }

      const delta = extractHermesStreamDelta(message);
      if (delta) {
        rawText += delta;
        await input.onDelta?.(delta);
        continue;
      }

      if (
        message.data &&
        typeof message.data === "object" &&
        !Array.isArray(message.data)
      ) {
        const payload = message.data as HermesResponsesApiResponse & { type?: string };
        if (payload.type === "response.completed" || message.event === "response.completed") {
          completedPayload = payload;
        }

        if (!rawText && Array.isArray(payload.output)) {
          const snapshotText = extractTextFromOutput(payload.output);
          if (snapshotText && !emittedSnapshot) {
            rawText = snapshotText;
            emittedSnapshot = true;
            await input.onDelta?.(snapshotText);
          }
        }
      }
    }

    if (done) {
      break;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = parseHermesSseBuffer(`${buffer}\n\n`);
    for (const message of parsed.messages) {
      const delta = extractHermesStreamDelta(message);
      if (delta) {
        rawText += delta;
        await input.onDelta?.(delta);
      }
    }
  }

  if (!rawText && Array.isArray(completedPayload?.output)) {
    rawText = extractTextFromOutput(completedPayload.output || []);
  }

  if (!rawText) {
    throw new Error("Hermes returned an empty streamed response");
  }

  return rawText;
}

export async function requestHermesDoctorBotReply(input: {
  assistantName: string;
  conversationId: string;
  content: string;
  enabledScales: ScaleDefinition[];
}) {
  const rawText = await requestHermesResponseText({
    conversationId: input.conversationId,
    content: input.content,
    instructions: buildDoctorBotInstructions({
      assistantName: input.assistantName,
      enabledScales: input.enabledScales,
    }),
  });

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

export async function requestHermesAgentTriageReply(input: {
  conversationId: string;
  prompt: string;
  language: LanguageCode;
  tenantContext?: HermesAgentTenantContext;
}) {
  const rawText = await requestHermesResponseText({
    conversationId: input.conversationId,
    content: input.prompt,
    instructions: buildAgentTriageInstructions({
      language: input.language,
      tenantContext: input.tenantContext,
    }),
  });

  return {
    rawText,
    aiResponse: parseAIResponse(rawText),
  } satisfies HermesAgentReply;
}

export async function requestHermesAgentTriageReplyStream(input: {
  conversationId: string;
  prompt: string;
  language: LanguageCode;
  tenantContext?: HermesAgentTenantContext;
  onDelta?: ((delta: string) => void | Promise<void>) | undefined;
}) {
  const rawText = await requestHermesStreamText({
    conversationId: input.conversationId,
    content: input.prompt,
    instructions: buildAgentTriageInstructions({
      language: input.language,
      tenantContext: input.tenantContext,
    }),
    onDelta: input.onDelta,
  });

  return {
    rawText,
    aiResponse: parseAIResponse(rawText),
  } satisfies HermesAgentReply;
}
