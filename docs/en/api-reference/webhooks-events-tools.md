---
title: Webhooks, Events, Tools & Health
---

import { OpenApiOperation, OpenApiProvider, OpenApiSettings } from '@site/src/components/openapi';

<!-- Render webhook/event/tool APIs with per-operation OpenAPI cards. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126 -->



## Introduction

These endpoints cover:

- Webhook ingestion (GitHub/GitLab)
- Global Server-Sent Events stream (topic-scoped)
- System tools meta (admin tools ports)
- Health checks

<OpenApiProvider>
<OpenApiSettings />

## APIs

### POST `/api/webhook/gitlab/:repoId`
<OpenApiOperation operationId="webhook_gitlab" />

### POST `/api/webhook/github/:repoId`
<OpenApiOperation operationId="webhook_github" />

### GET `/api/events/stream`
<OpenApiOperation operationId="events_stream" />

### GET `/api/tools/meta`
<OpenApiOperation operationId="tools_meta" />

### GET `/api/health`
<OpenApiOperation operationId="health_get" />
</OpenApiProvider>

## Notes

- Webhook endpoints verify signatures using the repository’s configured webhook secret.
- For SSE endpoints, prefer Authorization headers, but `?token=` is supported for `EventSource`.
- Health checks are typically exempt from auth when `AUTH_EXEMPT_HEALTH=true` (default).
