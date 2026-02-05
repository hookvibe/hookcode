---
name: hookcode-pat-api-debug
description: Debug HookCode APIs using PAT-authenticated requests. Use to test /api endpoints and verify PAT permissions.
---

# Hookcode PAT API Debug (Gemini)

## Overview

Call backend endpoints with `Authorization: Bearer <PAT>` using the provided script.

## Usage

1.  **Configure:** Set `HOOKCODE_API_BASE_URL` and `HOOKCODE_PAT` in `.gemini/skills/hookcode-pat-api-debug/.env`.
2.  **GET Request:**
    ```bash
    node .gemini/skills/hookcode-pat-api-debug/scripts/pat_request.mjs --path /api/users/me
    ```
3.  **POST/PATCH Request:**
    ```bash
    node .gemini/skills/hookcode-pat-api-debug/scripts/pat_request.mjs \
      --method PATCH \
      --path /api/users/me \
      --body '{"displayName":"Debug"}'
    ```

## CLI Options

- `--path`: API path.
- `--url`: Full URL override.
- `--method`: HTTP method.
- `--body`: JSON body (use `@file.json` to read from file).
- `--query`: Add query parameters.
- `--dry-run`: Print request details without sending.