---
title: Troubleshooting
---



## Webhook does not trigger tasks

Checklist:

- Confirm HookCode is reachable from your Git provider (public URL or tunnel).
- Confirm webhook URL uses the correct base and includes `/api/webhook/<provider>/<repoId>`.
- Confirm webhook secret matches the one shown in the HookCode console.
- Check webhook delivery history in your provider and in the HookCode console (Webhook Deliveries panel).
- Ensure the repository is enabled (not disabled/archived).

## “Unauthorized” / 401

- If `AUTH_ENABLED=true`, the console must authenticate and send `Authorization: Bearer <token>`.
- Ensure `AUTH_TOKEN_SECRET` is set and stable (tokens will break if you change it).

## Task logs are missing / SSE returns 404

- Task logs are controlled by feature flags:
  - `TASK_LOGS_DB_ENABLED`
  - `TASK_LOGS_VISIBLE_ENABLED`
- The console reads `/api/auth/me` feature flags to decide whether to display logs.

## Robot test fails

Common causes:

- Repo provider token missing permissions (cannot read repo or post comments).
- Wrong token selected (user vs repo vs robot token source mismatch).
- Model provider API key missing/invalid when the robot is configured to use robot-level credentials.

## CORS errors in browser

- Configure `ALLOWED_ORIGIN` on the backend.
- In production, prefer explicit origins instead of `*`.

