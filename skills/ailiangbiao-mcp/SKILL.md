---
name: ailiangbiao-mcp
description: Use when an external agent, MCP client, or skill platform needs to call the AIliangbiao MCP service at tongyimohe.cloud for child clinical scale catalog lookup, assessment sessions, web handoff links, natural-language answer mapping and confirmation, deterministic scoring, or growth-curve tools.
---

# AIliangbiao MCP

Use the deployed system-state MCP endpoint:

```text
https://tongyimohe.cloud/api/mcp
```

Prefer `streamableHTTP` when a skill platform asks for the MCP protocol type. Use SSE compatibility only when the platform cannot send JSON-RPC POST requests directly.

Authenticate every MCP request with:

```text
Authorization: Bearer <MCP_API_KEY>
Content-Type: application/json
Accept: application/json, text/event-stream
```

Create the MCP key in the AIliangbiao admin console at `/admin/mcpkeys`. Store it in the calling platform secret manager or environment variables. Never write real keys into this skill folder, examples, logs, prompts, or committed files.

Some skill platforms automatically send `MCP-Protocol-Version` or `Last-Event-ID` during streamableHTTP/SSE checks. The server allows those headers in CORS preflight; do not add them manually unless the platform requires it.

## Core Rules

- Prefer the canonical endpoint `/api/mcp`; use compatibility endpoints only when a client cannot call the canonical route.
- Prefer `streamableHTTP` JSON-RPC POST calls; keep SSE compatibility as a fallback.
- Treat MCP as the source of truth for scale schema, assessment sessions, submitted answers, deterministic scoring, growth tools, and doctor-review status.
- Do not let an LLM invent final scores, risk levels, diagnoses, or formal reports.
- Confirm low-confidence natural-language answer mappings before submitting structured answers.
- Do not expose child identifiers, raw private conversations, or unreviewed formal reports to external platforms.

## References

- Read `references/mcp-tools.md` before selecting tools or constructing JSON-RPC calls.
- Read `references/workflows.md` before orchestrating catalog lookup, Web Handoff, or per-question collection.
- Read `references/security.md` before handling keys, child data, exports, logs, or medical wording.

## Smoke Test

Run the read-only connectivity check:

```bash
AILIANGBIAO_MCP_API_KEY="<MCP_API_KEY>" node skills/ailiangbiao-mcp/scripts/mcp-smoke-test.mjs
```

Set `AILIANGBIAO_MCP_LIST_SCALES=1` only when you also want to call the read-only `list_supported_scales` tool. The smoke test does not create sessions, submit answers, or write database records.
