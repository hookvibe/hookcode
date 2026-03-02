---
title: Open API Docs
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
{/* Refresh API reference overview for Mintlify OpenAPI navigation. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



This section documents HookCode’s backend APIs (served under the `/api` global prefix by default).

{/* Highlight the OpenAPI-driven docs workflow. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126 */}

<Callout type="info" title="OpenAPI spec location">
  The OpenAPI JSON is served by the backend at `/api/openapi.json`. See the **OpenAPI Spec** page for access details.
</Callout>

## OpenAPI-linked docs
{/* Link the OpenAPI spec page now that auto-generated endpoints are disabled locally. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
Each API page summarizes the endpoint surface for its domain. For full request/response schemas, use the live OpenAPI JSON served at `/api/openapi.json`.
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
 - `GET /api/logs/stream`
<!-- Add system log SSE to the API reference list. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 -->
- `GET /api/events/stream?topics=notifications`
<!-- Document notification SSE topic usage. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302 -->

These support `?token=<token>` for clients that cannot set headers (e.g. `EventSource`).

## Sections

- [OpenAPI Spec](./openapi)
- [Auth & Users](./auth-users)
- [Repositories](./repositories)
- [Tasks, Task Groups & Chat](./tasks-and-groups)
- [System Logs](./logs)
<!-- Link new system log API page. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 -->
- [Notifications](./notifications)
<!-- Link notifications API page. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302 -->
- [Webhooks, Events, Tools & Health](./webhooks-events-tools)
