# Workflows

Use the canonical endpoint `https://tongyimohe.cloud/api/mcp` with `Authorization: Bearer <MCP_API_KEY>`. Prefer `streamableHTTP`; use SSE compatibility only when the caller requires it.

## 1. Read-Only Catalog Query

Use this when an external agent only needs to know what scales and tools are available.

1. Call `initialize`.
2. Call `tools/list`.
3. Call `list_supported_scales`.
4. Call `get_scale_schema` for the selected scale.
5. Present scale names, scope, interaction mode, and doctor-review requirements without exposing private child data.

Do not create sessions or submit answers in this workflow.

## 2. Web Handoff for Long Forms

Use this when a scale is long, the user is on a phone, or the agent should not collect every answer in chat.

1. Call `list_supported_scales` and select a scale.
2. Call `get_scale_schema` and inspect `interactionMode`, `resultDeliveryMode`, and doctor-review requirements.
3. Call `generate_assessment_link` with a stable external `deviceId` and minimal participant context.
4. Ask the user to open the returned URL or QR code and complete the form in AIliangbiao.
5. Poll or later call `get_assessment_result`.
6. If the result requires `physician_review`, tell the user the formal report must wait for doctor review.

Do not continue a long `web_handoff` scale through `get_current_question -> submit_answer` after the handoff link is issued unless the product policy explicitly asks for it.

## 3. Per-Question Conversational Collection

Use this when the agent is guiding the user question by question.

1. Call `create_assessment_session`.
2. Call `get_current_question`.
3. Ask the user the current question in plain language.
4. For natural-language replies, call `map_natural_language_answer`.
5. If confidence is low or the user is unsure, ask a follow-up question or call `confirm_mapped_answer` only after explicit confirmation.
6. Call `submit_answer` with the confirmed structured answer.
7. Repeat from `get_current_question` until complete.
8. Call `get_assessment_result`.
9. Respect doctor-review gates before showing formal conclusions or reports.

## Boundaries

- AI can assist with explanation, mapping, and follow-up questions.
- AI cannot decide final score, diagnosis, risk level, or formal report approval.
- Deterministic scoring belongs to AIliangbiao MCP/backend tools.
- Low-confidence mapped answers must be confirmed before submission.
- If the user asks for medical advice, provide safety wording and direct them to qualified clinical review.
