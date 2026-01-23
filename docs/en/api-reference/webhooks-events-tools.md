---
title: Webhooks, Events, Tools & Health
---



## Introduction

These endpoints cover:

- Webhook ingestion (GitHub/GitLab)
- Global Server-Sent Events stream (topic-scoped)
- System tools meta (admin tools ports)
- Health checks

## APIs

| Method | Path | Auth | Operation ID | Description |
| --- | --- | --- | --- | --- |
| POST | `/api/webhook/gitlab/:repoId` | Public | `webhook_gitlab` | Receive GitLab webhook events for a repository id. |
| POST | `/api/webhook/github/:repoId` | Public | `webhook_github` | Receive GitHub webhook events for a repository id. |
| GET | `/api/events/stream` | Bearer or `?token=` | `events_stream` | SSE: topic-scoped event stream (supports `?topics=`). |
| GET | `/api/tools/meta` | Bearer | `tools_meta` | System tools meta (whether admin tools are enabled and exposed ports). |
| GET | `/api/health` | Public (when `AUTH_EXEMPT_HEALTH=true`) | `health_get` | Health check (service + DB). |

## Notes

- Webhook endpoints verify signatures using the repository’s configured webhook secret.
- For SSE endpoints, prefer Authorization headers, but `?token=` is supported for `EventSource`.
- Health checks are typically exempt from auth when `AUTH_EXEMPT_HEALTH=true` (default).

