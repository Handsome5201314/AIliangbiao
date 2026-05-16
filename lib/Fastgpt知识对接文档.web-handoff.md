# Web Handoff Addendum

This addendum extends the existing FastGPT integration notes with the new `web_handoff` branch.

## Flow

1. Call `generate_assessment_link`
2. Read `handoff.url` (and optionally `handoff.qrCodeUrl`)
3. Let the user open the public handoff page and submit the form
4. Prefer polling `get_assessment_result` based on `completion.pollAfterSeconds`
5. If you keep a conversational loop, the user can still say "done" as a reminder signal before polling again

## Tool Response Additions (FastGPT Friendly)

`create_assessment_session` / `generate_assessment_link` now include:

- `handoff.url`: public handoff link
- `handoff.qrCodeUrl`: ready-to-display QR code image URL
- `completion`: unified state object for orchestration
- `nextAction`: suggested follow-up tool call (`get_assessment_result`)
- `userPrompt`: suggested natural-language prompt to user
- `callback` (when configured): callback registration status for webhook delivery

`get_assessment_result` now includes:

- `completion.status`: `pending | completed | closed`
- `completion.hasFinalResult`
- `completion.shouldPollResult`
- `completion.pollAfterSeconds`
- `result`: final result when available (otherwise `null`)
- `handoff` (when applicable): same link + QR payload for reminder
- `callback` (when configured): callback delivery status, attempts, and last error

## Suggested FastGPT Orchestration

1. Call `generate_assessment_link`
2. Send user `handoff.url` (or render `handoff.qrCodeUrl`)
3. Read `completion.shouldPollResult` and `completion.pollAfterSeconds`
4. Poll `get_assessment_result` until `completion.hasFinalResult = true`
5. If `completion.status = pending`, remind user to finish the form and retry later
6. If `completion.status = closed`, treat the session as cancelled or expired
7. If `completion.hasFinalResult = true`, answer using `result`

## Optional Webhook Callback

`generate_assessment_link` and `create_assessment_session` accept optional fields:

- `callbackUrl`
- `callbackSecret`
- `callbackMetadata`

If configured, the project will POST the final structured result after the public handoff form is submitted.

Callback headers:

- `X-Ailiangbiao-Timestamp`
- `X-Ailiangbiao-Signature` (`sha256=...`) when `callbackSecret` is provided

Recommended strategy:

- Keep polling as the baseline integration
- Treat webhook as a real-time enhancement, not the only delivery mechanism

## Rules

- Do not continue with `get_current_question -> submit_answer` once a scale is marked `web_handoff`
- The public handoff page still writes into the same `AssessmentSession`
- The result is still fetched with `get_assessment_result`
- Reuse the same `deviceId` for the full tool chain
