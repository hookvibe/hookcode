---
title: Open API Docs
---



This section documents HookCode’s backend APIs (served under the `/api` global prefix by default).

## Base URL

In the console, the API base is configured via `VITE_API_BASE_URL` (frontend build-time).

Common examples:

- Local dev: `http://127.0.0.1:4000/api`
- Reverse proxy: `/api`

## Authentication

When `AUTH_ENABLED=true`, most endpoints require:

```
Authorization: Bearer <token>
```

Get a token via `POST /api/auth/login`.

## Real-time APIs (SSE)

Some endpoints stream Server-Sent Events:

- `GET /api/events/stream`
- `GET /api/tasks/:id/logs/stream`

These support `?token=<token>` for clients that cannot set headers (e.g. `EventSource`).

## Sections

- [Auth & Users](./auth-users)
- [Repositories](./repositories)
- [Tasks, Task Groups & Chat](./tasks-and-groups)
- [Webhooks, Events, Tools & Health](./webhooks-events-tools)

