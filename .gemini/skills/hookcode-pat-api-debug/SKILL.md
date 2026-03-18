---
name: hookcode-pat-api-debug
description: Send PAT-authenticated requests to HookCode backend APIs for debugging. Use when you need to call /api endpoints, verify PAT scope behavior, or inspect responses using a PAT and base URL stored in an env file.
tags:
  - api
  - debug
  - auth
---

# Hookcode PAT API Debug (Gemini)

## Overview

Use the bundled Node.js script to call HookCode backend endpoints with `Authorization: Bearer <PAT>`.
Keep tokens out of logs and prefer `.env` or environment variables for secrets.

## Quick Start

1. Copy `.gemini/skills/hookcode-pat-api-debug/.env.example` to `.gemini/skills/hookcode-pat-api-debug/.env` and fill in values.
2. Run a GET request:

```bash
node .gemini/skills/hookcode-pat-api-debug/scripts/pat_request.mjs --path /api/users/me
```

3. Run a write request with JSON:

```bash
node .gemini/skills/hookcode-pat-api-debug/scripts/pat_request.mjs \
  --method PATCH \
  --path /api/users/me \
  --body '{"displayName":"Debug Name"}'
```

## CLI Options

- `--path /api/...` Required unless `--url` is provided.
- `--url https://host/api/...` Full URL override.
- `--method GET|POST|PATCH|PUT|DELETE` Defaults to `GET` or `POST` when `--body` is set.
- `--body '{"key":"value"}'` Send a request body; prefix with `@` to read from file.
- `--raw` Send body as plain text instead of parsing JSON.
- `--query key=value` Repeat to append query params.
- `--header 'Name: Value'` Repeat to add extra headers.
- `--dry-run` Print the request without sending it; PAT is redacted.

## Notes

- The script reads `.env` from the skill root, then falls back to process env.
- Required vars: `HOOKCODE_API_BASE_URL`, `HOOKCODE_PAT`.
- If a local request fails with `fetch failed`, verify the backend is reachable and your execution environment allows local network access.
- Avoid copying PATs into chat or logs; rotate tokens after debugging if needed.

## Resources

- `scripts/pat_request.mjs`
- `.env.example`
