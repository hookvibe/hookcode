---
title: Tasks, Task Groups & Chat
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Replace legacy OpenAPI MDX components with Mintlify endpoint mapping. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



## Introduction

These endpoints cover:

- Task listing, filtering, and detail retrieval
- Task logs (fetch/clear) and real-time logs (SSE)
- Task retry and deletion
- Task groups (grouped histories, including chat groups)
- Manual chat execution (`/chat`)
- Dashboard aggregation endpoints

<Callout type="info" title="OpenAPI-backed details">
  Full request/response schemas are available under the **Endpoints** group in the sidebar (powered by `/api/openapi.json`).
</Callout>

## Endpoint Map

- `GET /api/tasks` — List tasks with filters and pagination.
- `GET /api/tasks/stats` — Aggregate task statistics.
- `GET /api/tasks/volume` — Fetch task volume over time.
- `GET /api/tasks/:id` — Fetch task details.
- `POST /api/tasks/:id/retry` — Retry a task.
- `DELETE /api/tasks/:id` — Delete a task.
- `GET /api/tasks/:id/logs` — Fetch task logs.
- `DELETE /api/tasks/:id/logs` — Clear task logs.
- `GET /api/tasks/:id/logs/stream` — Stream task logs over SSE.
- `GET /api/task-groups` — List task groups.
- `GET /api/task-groups/:id` — Fetch task group details.
- `GET /api/task-groups/:id/tasks` — List tasks for a group.
- `GET /api/dashboard/sidebar` — Fetch sidebar aggregation data.
- `POST /api/chat` — Execute a manual chat task.

{/* Document paged task log access after the log-table migration. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306 */}
## Task Logs Pagination

- `GET /api/tasks/:id/logs` supports `limit` (default `200`, max `1000`) and `before` (sequence cursor) to page older lines.
- Responses include `startSeq`, `endSeq`, and optional `nextBefore` for fetching the next page of earlier logs.
- SSE `init` events include `{ logs, startSeq, endSeq, nextBefore }`; `log` events include `{ line, seq }` for live updates.

## Notes

- Task logs can be disabled via feature flags; when disabled, log endpoints may return `404`.
- The console reads `/api/auth/me` feature flags to decide whether to show logs and connect SSE streams.
- SSE endpoints support `?token=<bearer>` because `EventSource` cannot set custom headers.
- Archived tasks/repositories may block retries to preserve archive “view-only” semantics.
<!-- Clarify that task logs are no longer embedded in task result payloads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306 -->
- Task result payloads no longer include logs; use the log endpoints to fetch or stream log lines.
{/* Document the includeQueue toggle used to trim task list payloads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128 */}
- `GET /api/tasks` accepts `includeQueue=false` to skip queue diagnosis fields for faster dashboard/task summary reads.
