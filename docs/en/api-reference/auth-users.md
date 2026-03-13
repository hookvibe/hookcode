---
title: Auth & Users
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Replace legacy OpenAPI MDX components with Mintlify endpoint mapping. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



## Introduction

These endpoints cover:

- Console authentication (`/auth/*`)
- Current user profile updates (`/users/me`)
- Credential profile management for model/repo providers (redacted in responses)

<Callout type="info" title="OpenAPI-backed details">
  Full request/response schemas are available under the **Endpoints** group in the sidebar (powered by `/api/openapi.json`).
</Callout>

## Endpoint Map

- `POST /api/auth/login` — Authenticate and return an access token.
{/* Document registration + verification endpoints. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- `POST /api/auth/register` — Register a new user (when registration is enabled).
- `POST /api/auth/verify-email` — Verify a pending registration email.
- `GET /api/auth/me` — Fetch current auth status and user profile.
- `PATCH /api/users/me` — Update profile details for the current user.
- `PATCH /api/users/me/password` — Change the current user password.
- `GET /api/users/me/model-credentials` — Fetch stored model credentials (redacted).
- `PATCH /api/users/me/model-credentials` — Update model credentials for the current user.
<!-- Document the local provider runtime-status endpoint added for ClaudeCodeUI-style auth detection. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313 -->
- `GET /api/users/me/model-providers/status` — Fetch local provider runtime/auth status for Codex, Claude Code, and Gemini.
- `POST /api/users/me/model-credentials/models` — List available models for a provider.

## Notes

- When auth is disabled (`AUTH_ENABLED=false`), `/api/auth/me` returns `authEnabled=false` and `user=null`.
- Credentials are always redacted in API responses:
  - Tokens / API keys are never returned once stored.
  - “Set/keep” UI modes should be used to avoid accidentally clearing secrets.
- Model listing endpoints return explicit error codes for common mistakes (example: invalid/unauthorized API key).