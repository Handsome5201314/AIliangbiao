# MCP Tools

Default endpoint:

```text
https://tongyimohe.cloud/api/mcp
```

Auth header:

```text
Authorization: Bearer <MCP_API_KEY>
Content-Type: application/json
Accept: application/json, text/event-stream
```

The key is created in `/admin/mcpkeys` and must be stored outside this skill.

Protocol choice:

- Prefer `streamableHTTP` for new skill-platform integrations.
- Use SSE compatibility only for clients that require a long-lived event stream.

## JSON-RPC Shape

List tools:

```json
{
  "jsonrpc": "2.0",
  "id": "tools-list-1",
  "method": "tools/list",
  "params": {}
}
```

Call a tool:

```json
{
  "jsonrpc": "2.0",
  "id": "call-1",
  "method": "tools/call",
  "params": {
    "name": "list_supported_scales",
    "arguments": {}
  }
}
```

## Canonical Tools

### Catalog and Schema

| Tool | Purpose | Notes |
| --- | --- | --- |
| `list_supported_scales` | List supported child clinical scales. | Read-only. Use before choosing a scale. |
| `get_scale_schema` | Return scale metadata, questions, options, delivery mode, and doctor-review requirements. | Read-only. Prefer for structured clients. |
| `get_scale_questions` | Return question-oriented scale data. | Read-only compatibility-friendly shape. |
| `recommend_assessment` | Recommend suitable assessment flow from context. | Read-only recommendation, not a diagnosis. |
| `recommend_scale` | Recommend a scale from symptoms or context. | Read-only recommendation, not a diagnosis. |
| `score_assessment` | Run deterministic scoring on provided structured answers. | Does not persist answers. Never replace doctor review. |

### Sessions and Handoff

| Tool | Purpose | Notes |
| --- | --- | --- |
| `create_assessment_session` | Create an assessment session for a selected scale and external participant context. | Writes a session record. Use only after consent and scope are clear. |
| `generate_assessment_link` | Generate a public Web Handoff link for long-form completion. | Writes/uses a session and returns a URL for the user. |
| `get_current_question` | Fetch the current or next question for a session. | Read-only session progression view. |
| `submit_answer` | Submit one structured answer for a session. | Writes answer data. Use confirmed structured answers only. |
| `get_assessment_result` | Fetch result and completion state. | Respect `physician_review` and visibility gates. |
| `pause_assessment_session` | Pause a running session. | Writes session state. |
| `resume_assessment_session` | Resume a paused session. | Writes session state. |
| `cancel_assessment_session` | Cancel a session. | Writes session state; use only with explicit intent. |

### Natural-Language Answer Mapping

| Tool | Purpose | Notes |
| --- | --- | --- |
| `map_natural_language_answer` | Map free-text or spoken user answers to candidate structured options. | Produces candidates and confidence; it is not final submission. |
| `confirm_mapped_answer` | Confirm a mapped candidate after user confirmation. | Required before submitting low-confidence or ambiguous answers. |

Confidence policy:

- `confidence < 0.80`: ask the user to confirm before submission.
- `confidence < 0.60`: require explicit option selection.
- If the user says they are unsure, ask follow-up questions or use Web Handoff instead of guessing.

### Growth Tools

| Tool | Purpose | Notes |
| --- | --- | --- |
| `add_growth_record` | Add height/weight/head-circumference style growth data. | Writes growth records; require consent and minimal data. |
| `get_growth_history` | Fetch growth history for the requested context. | Read-only. Avoid exposing identifiers. |
| `evaluate_growth` | Evaluate current growth status. | Not a clinical diagnosis. |

## Compatibility Tools

Older clients may see or call:

- `list_scales`
- `submit_assessment`
- `submit_and_evaluate`

Do not promote these names for new integrations. Prefer the canonical tools above.

## Common Argument Guidance

- Use a stable `deviceId` for the external session or device. Do not use a real child name as `deviceId`.
- Use synthetic or minimal `memberSnapshot` data unless the workflow has explicit consent to process real participant data.
- Keep callback metadata deidentified.
- For Web Handoff, pass only the data needed to create the assessment link and let the user complete the form in AIliangbiao.
- For formal report visibility, follow the result payload and doctor-review status. Do not infer approval from a completed score.
