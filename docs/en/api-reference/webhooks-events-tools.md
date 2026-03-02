---
title: Webhooks, Events, Tools & Health
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Replace legacy OpenAPI MDX components with Mintlify endpoint mapping. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



## Introduction

These endpoints cover:

- Webhook ingestion (GitHub/GitLab)
- Global Server-Sent Events stream (topic-scoped)
- System tools meta (admin tools ports)
- Health checks

<Callout type="info" title="OpenAPI-backed details">
  Full request/response schemas are available under the **Endpoints** group in the sidebar (powered by `/api/openapi.json`).
</Callout>

## Endpoint Map

- `POST /api/webhook/gitlab/:repoId` — GitLab webhook ingestion endpoint.
- `POST /api/webhook/github/:repoId` — GitHub webhook ingestion endpoint.
- `GET /api/events/stream` — Global SSE stream for events.
- `GET /api/tools/meta` — Admin tools metadata.
- `GET /api/health` — Health check endpoint.

## Notes

- Webhook endpoints verify signatures using the repository’s configured webhook secret.
- For SSE endpoints, prefer Authorization headers, but `?token=` is supported for `EventSource`.
- Health checks are typically exempt from auth when `AUTH_EXEMPT_HEALTH=true` (default).