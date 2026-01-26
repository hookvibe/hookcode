---
title: Tasks, Task Groups & Chat
---

import { OpenApiOperation, OpenApiProvider, OpenApiSettings } from '@site/src/components/openapi';

<!-- Render task APIs with per-operation OpenAPI cards. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126 -->



## Introduction

These endpoints cover:

- Task listing, filtering, and detail retrieval
- Task logs (fetch/clear) and real-time logs (SSE)
- Task retry and deletion
- Task groups (grouped histories, including chat groups)
- Manual chat execution (`/chat`)
- Dashboard aggregation endpoints

<OpenApiProvider>
<OpenApiSettings />

## APIs

### GET `/api/tasks`
<OpenApiOperation operationId="tasks_list" />

### GET `/api/tasks/stats`
<OpenApiOperation operationId="tasks_stats" />

### GET `/api/tasks/volume`
<OpenApiOperation operationId="tasks_volume_by_day" />

### GET `/api/tasks/:id`
<OpenApiOperation operationId="tasks_get" />

### POST `/api/tasks/:id/retry`
<OpenApiOperation operationId="tasks_retry" />

### DELETE `/api/tasks/:id`
<OpenApiOperation operationId="tasks_delete" />

### GET `/api/tasks/:id/logs`
<OpenApiOperation operationId="tasks_logs_get" />

### DELETE `/api/tasks/:id/logs`
<OpenApiOperation operationId="tasks_logs_clear" />

### GET `/api/tasks/:id/logs/stream`
<OpenApiOperation operationId="tasks_logs_stream" />

### GET `/api/task-groups`
<OpenApiOperation operationId="task_groups_list" />

### GET `/api/task-groups/:id`
<OpenApiOperation operationId="task_groups_get" />

### GET `/api/task-groups/:id/tasks`
<OpenApiOperation operationId="task_groups_tasks" />

### GET `/api/dashboard/sidebar`
<OpenApiOperation operationId="dashboard_sidebar" />

### POST `/api/chat`
<OpenApiOperation operationId="chat_execute" />
</OpenApiProvider>

## Notes

- Task logs can be disabled via feature flags; when disabled, log endpoints may return `404`.
- The console reads `/api/auth/me` feature flags to decide whether to show logs and connect SSE streams.
- SSE endpoints support `?token=<bearer>` because `EventSource` cannot set custom headers.
- Archived tasks/repositories may block retries to preserve archive “view-only” semantics.
