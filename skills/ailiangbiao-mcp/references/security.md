# Security and Privacy

## Secrets

- Do not store real MCP keys, SSH passwords, DeepSeek/OpenAI keys, database URLs, session secrets, or production env values in this skill.
- Use the external platform secret manager or environment variables for `AILIANGBIAO_MCP_API_KEY`.
- Redact keys in logs. Never print bearer tokens.
- Treat `HERMES_API_SERVER_KEY`, model provider keys, and MCP keys as different secrets.

## Child and Clinical Data

- Do not output child names, phone numbers, identity documents, addresses, raw parent conversations, or other direct identifiers.
- Use synthetic or deidentified examples in prompts, logs, demos, and exported artifacts.
- Minimize `memberSnapshot` fields. Send only what the selected workflow requires.
- Do not expose unreviewed formal reports to external platforms.

## Medical Safety

- AIliangbiao MCP tools can help collect answers, map responses, and compute deterministic scale outputs.
- External agents must not present AI output as a diagnosis, prescription, or final clinical report.
- If a result is gated by doctor review, say that the formal interpretation is pending review.
- If a user reports urgent safety concerns, stop routine scale collection and direct them to local emergency or qualified clinical help.

## Operational Safety

- Use the read-only smoke test before enabling write workflows.
- Start with `tools/list`, `list_supported_scales`, and `get_scale_schema`.
- Enable write tools such as `create_assessment_session`, `submit_answer`, and `add_growth_record` only after the caller has a clear consent and data-minimization policy.
- Do not retry write calls blindly. Check whether a session or record already exists before repeating a failed request.
