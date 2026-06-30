import test from "node:test";
import assert from "node:assert/strict";

import { shouldOpenMcpSseGet } from "../lib/mcp/accept";

test("MCP GET should open SSE only for explicit event-stream requests", () => {
  assert.equal(shouldOpenMcpSseGet("text/event-stream"), true);
  assert.equal(shouldOpenMcpSseGet("text/event-stream; charset=utf-8"), true);

  assert.equal(shouldOpenMcpSseGet("application/json"), false);
  assert.equal(shouldOpenMcpSseGet("application/json, text/event-stream"), false);
  assert.equal(shouldOpenMcpSseGet("text/event-stream, application/json"), false);
  assert.equal(shouldOpenMcpSseGet("*/*"), false);
  assert.equal(shouldOpenMcpSseGet(null), false);
});
