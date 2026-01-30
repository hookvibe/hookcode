---
name: hookcode-pat-api-debug
description: Send PAT-authenticated requests to HookCode backend APIs for debugging. Use when you need to call /api endpoints, verify PAT scope behavior, or test responses using a PAT and base URL stored in an env file.
---

# Hookcode PAT API Debug

<!-- Provide a PAT-authenticated request workflow for HookCode API debugging. docs/en/developer/plans/open-api-pat-skill-20260130/task_plan.md open-api-pat-skill-20260130 -->

## Overview

Use the bundled Node.js script to call HookCode backend endpoints with `Authorization: Bearer <PAT>`.
Keep tokens out of logs and prefer `.env` or environment variables for secrets.

## Quick Start

1. Copy `.codex/skills/hookcode-pat-api-debug/.env.example` to `.codex/skills/hookcode-pat-api-debug/.env` and fill in values.
2. Run a GET request:

```bash
node .codex/skills/hookcode-pat-api-debug/scripts/pat_request.mjs --path /api/users/me
```

3. Run a write request with JSON:

```bash
node .codex/skills/hookcode-pat-api-debug/scripts/pat_request.mjs \
  --method PATCH \
  --path /api/users/me \
  --body '{"displayName":"Debug Name"}'
```

## CLI Options

- `--path /api/...` Required unless `--url` is provided.
- `--url https://host/api/...` Full URL override.
- `--method GET|POST|PATCH|PUT|DELETE` Defaults to `GET` (or `POST` when `--body` is set).
- `--body '{"key":"value"}'` Send a request body; prefix with `@` to read from file.
- `--raw` Send body as plain text (skip JSON parsing).
- `--query key=value` Repeat to append query params.
- `--header 'Name: Value'` Repeat to add extra headers.
- `--dry-run` Print the request without sending it (PAT is redacted).

## Notes

- The script reads `.env` from the skill root, then falls back to process env.
- Required vars: `HOOKCODE_API_BASE_URL`, `HOOKCODE_PAT`.
- Avoid copying PATs into chat or logs; rotate tokens after debugging.

## Resources

- `scripts/pat_request.mjs`
- `.env.example`
