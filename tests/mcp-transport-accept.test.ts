import test from "node:test";
import assert from "node:assert/strict";

import { shouldOpenMcpSseGet } from "../lib/mcp/accept";
import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  getMcpResponseProtocolVersion,
  negotiateMcpProtocolVersion,
} from "../lib/mcp/protocol";

test("MCP GET should open SSE only for explicit event-stream requests", () => {
  assert.equal(shouldOpenMcpSseGet("text/event-stream"), true);
  assert.equal(shouldOpenMcpSseGet("text/event-stream; charset=utf-8"), true);

  assert.equal(shouldOpenMcpSseGet("application/json"), false);
  assert.equal(shouldOpenMcpSseGet("application/json, text/event-stream"), false);
  assert.equal(shouldOpenMcpSseGet("text/event-stream, application/json"), false);
  assert.equal(shouldOpenMcpSseGet("*/*"), false);
  assert.equal(shouldOpenMcpSseGet(null), false);
});

test("MCP initialize should negotiate modern streamableHTTP protocol versions", () => {
  assert.equal(DEFAULT_MCP_PROTOCOL_VERSION, "2025-06-18");
  assert.equal(negotiateMcpProtocolVersion("2025-06-18"), "2025-06-18");
  assert.equal(negotiateMcpProtocolVersion("2025-03-26"), "2025-03-26");
  assert.equal(negotiateMcpProtocolVersion("2024-11-05"), "2024-11-05");
  assert.equal(negotiateMcpProtocolVersion("1900-01-01"), "2025-06-18");
  assert.equal(
    getMcpResponseProtocolVersion({
      jsonrpc: "2.0",
      id: 1,
      result: { protocolVersion: "2025-06-18" },
    }),
    "2025-06-18"
  );
});
