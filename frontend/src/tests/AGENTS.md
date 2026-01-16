Frontend tests guardrails

# Purpose

Prevent CI and Docker failures caused by hardcoded API base URLs, ports, or origins in UI tests.

# Rules

- Never hardcode `http://localhost:4000` (or any port) in assertions.
- When asserting webhook URLs, use the same formatter as the UI:
  - `buildWebhookUrl(<relative webhook path>)` from `frontend/src/utils/webhook.ts`.
- If a test needs a custom API base, set `process.env.VITE_API_BASE_URL` in the test setup and assert via the shared helper.
- Prefer asserting the relative webhook path returned by the API mock when the UI only displays it.

# Rationale

CI Docker builds may run the API on a non-default port or behind a reverse proxy. Tests must stay aligned with runtime URL composition to avoid false failures.
