---
title: Tasks, Task Groups & Chat
---



## Introduction

These endpoints cover:

- Task listing, filtering, and detail retrieval
- Task logs (fetch/clear) and real-time logs (SSE)
- Task retry and deletion
- Task groups (grouped histories, including chat groups)
- Manual chat execution (`/chat`)
- Dashboard aggregation endpoints

## APIs

| Method | Path | Auth | Operation ID | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/tasks` | Bearer | `tasks_list` | List tasks (filters: repoId/robotId/status/eventType/archived). |
| GET | `/api/tasks/stats` | Bearer | `tasks_stats` | Aggregate task status counts (filters supported). |
| GET | `/api/tasks/volume` | Bearer | `tasks_volume_by_day` | Aggregate task volume by UTC day for a repo/date range. |
| GET | `/api/tasks/:id` | Bearer | `tasks_get` | Get task detail (sanitized output; logs gated by feature flags). |
| POST | `/api/tasks/:id/retry` | Bearer | `tasks_retry` | Retry a task (supports `?force=true` for certain stale processing cases). |
| DELETE | `/api/tasks/:id` | Bearer | `tasks_delete` | Delete a task. |
| GET | `/api/tasks/:id/logs` | Bearer | `tasks_logs_get` | Get task logs (requires task logs feature enabled). |
| DELETE | `/api/tasks/:id/logs` | Bearer | `tasks_logs_clear` | Clear task logs (requires task logs feature enabled). |
| GET | `/api/tasks/:id/logs/stream` | Bearer or `?token=` | `tasks_logs_stream` | SSE stream for task logs (EventSource-friendly). |
| GET | `/api/task-groups` | Bearer | `task_groups_list` | List task groups (filters supported). |
| GET | `/api/task-groups/:id` | Bearer | `task_groups_get` | Get task group detail. |
| GET | `/api/task-groups/:id/tasks` | Bearer | `task_groups_tasks` | List tasks under a task group. |
| GET | `/api/dashboard/sidebar` | Bearer | `dashboard_sidebar` | Dashboard sidebar snapshot (stats + lists + groups). |
| POST | `/api/chat` | Bearer | `chat_execute` | Create a queued task without Webhooks (manual trigger). |

## Notes

- Task logs can be disabled via feature flags; when disabled, log endpoints may return `404`.
- The console reads `/api/auth/me` feature flags to decide whether to show logs and connect SSE streams.
- SSE endpoints support `?token=<bearer>` because `EventSource` cannot set custom headers.
- Archived tasks/repositories may block retries to preserve archive “view-only” semantics.

