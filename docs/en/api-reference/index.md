---
title: Open API Docs
---



This section documents HookCode’s backend APIs (served under the `/api` global prefix by default).

<!-- Highlight the OpenAPI-driven docs workflow. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126 -->

## OpenAPI-linked docs

Each API page now renders per-operation sections powered by the OpenAPI spec. Configure the spec URL, API base, and token once at the top of each page to enable Try It requests.
Default spec URL: `/api/openapi.json` (requires auth when `AUTH_ENABLED=true`).

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
