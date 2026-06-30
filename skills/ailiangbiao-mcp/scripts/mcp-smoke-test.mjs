#!/usr/bin/env node

const DEFAULT_URL = "https://tongyimohe.cloud/api/mcp";

const mcpUrl = process.env.AILIANGBIAO_MCP_URL || DEFAULT_URL;
const apiKey = process.env.AILIANGBIAO_MCP_API_KEY;
const shouldListScales = process.env.AILIANGBIAO_MCP_LIST_SCALES === "1";

if (!apiKey) {
  console.error(
    "Missing AILIANGBIAO_MCP_API_KEY. Create an MCP key in /admin/mcpkeys and pass it through the environment.",
  );
  process.exit(2);
}

let nextId = 1;

async function rpc(method, params = {}) {
  const id = String(nextId++);
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });

  const text = await response.text();
  const parsed = parseResponse(text);

  if (!response.ok) {
    throw new Error(
      `${method} failed with HTTP ${response.status}: ${summarizeBody(parsed, text)}`,
    );
  }

  if (parsed && parsed.error) {
    throw new Error(`${method} returned JSON-RPC error: ${JSON.stringify(parsed.error)}`);
  }

  return parsed;
}

function parseResponse(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const dataLine = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));

  if (dataLine) {
    const payload = dataLine.slice("data:".length).trim();
    if (payload && payload !== "[DONE]") {
      return JSON.parse(payload);
    }
  }

  return { rawText: trimmed.slice(0, 500) };
}

function summarizeBody(parsed, text) {
  if (parsed && !parsed.rawText) {
    return JSON.stringify(parsed).slice(0, 500);
  }
  return text.trim().slice(0, 500);
}

function resultOf(response) {
  return response && typeof response === "object" && "result" in response
    ? response.result
    : response;
}

function extractTools(toolsResult) {
  if (!toolsResult) {
    return [];
  }
  if (Array.isArray(toolsResult.tools)) {
    return toolsResult.tools;
  }
  if (Array.isArray(toolsResult)) {
    return toolsResult;
  }
  return [];
}

function extractToolContent(callResult) {
  const result = resultOf(callResult);
  if (!result) {
    return null;
  }

  if (Array.isArray(result.content)) {
    const textContent = result.content.find(
      (item) => item && item.type === "text" && typeof item.text === "string",
    );
    if (textContent) {
      try {
        return JSON.parse(textContent.text);
      } catch {
        return textContent.text;
      }
    }
  }

  return result;
}

console.log(`AIliangbiao MCP smoke test: ${mcpUrl}`);

try {
  const initialize = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "ailiangbiao-mcp-smoke-test",
      version: "0.1.0",
    },
  });

  const toolsList = await rpc("tools/list", {});
  const tools = extractTools(resultOf(toolsList));
  const toolNames = tools.map((tool) => tool.name).filter(Boolean);

  console.log("initialize: ok");
  console.log(`tools/list: ok (${toolNames.length} tools)`);
  console.log(`sample tools: ${toolNames.slice(0, 12).join(", ") || "none"}`);

  if (shouldListScales) {
    const scalesResponse = await rpc("tools/call", {
      name: "list_supported_scales",
      arguments: {},
    });
    const content = extractToolContent(scalesResponse);
    const scales = Array.isArray(content?.scales)
      ? content.scales
      : Array.isArray(content)
        ? content
        : [];
    console.log(`list_supported_scales: ok (${scales.length} scales)`);
  }

  if (!initialize) {
    console.log("initialize response was empty; server accepted the request.");
  }
} catch (error) {
  console.error(`Smoke test failed: ${error.message}`);
  process.exit(1);
}
