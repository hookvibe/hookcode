Backend tests guardrails

# Purpose

Avoid brittle tests that assume a fixed host or port when validating webhook URLs or API base URLs.

# Rules

- Prefer asserting relative webhook paths returned by the backend (e.g., `/api/webhook/gitlab/<id>`).
- If a full URL must be asserted, build it from config/env used by the backend; do not inline `localhost` or a hardcoded port.
- Keep test fixtures aligned with production behavior: backend emits relative paths and the frontend composes full URLs.

# Rationale

CI Docker environments frequently use non-default ports or reverse proxies. URL assertions should remain portable across environments.
