---
title: System Logs
---
<!-- Document admin system log APIs for the settings log tab. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 -->

This page documents the admin-only system log APIs.
<!-- Add business event log examples and retention notes. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 -->

## Log entry schema

Each log entry contains:
- `id` (string)
- `category` (`system` | `operation` | `execution`)
- `level` (`info` | `warn` | `error`)
- `message` (string)
- `code` (string, optional)
- `actorUserId` (string, optional)
- `repoId` (string, optional)
- `taskId` (string, optional)
- `taskGroupId` (string, optional)
- `meta` (object, optional; sensitive fields are redacted)
- `createdAt` (ISO timestamp)

<!-- Document retention override env var for log cleanup. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 -->
Retention: logs are kept for 30 days and cleaned up automatically. You can override the retention window with `LOG_RETENTION_DAYS` (number of days) in the backend environment.

## List logs

`GET /api/logs`

Query params:
- `limit` (number, optional): page size (default 50)
- `cursor` (string, optional): pagination cursor from the previous response
- `category` (system | operation | execution)
- `level` (info | warn | error)
- `repoId` (string, optional)
- `taskId` (string, optional)
- `taskGroupId` (string, optional)
- `q` (string, optional): search query (message/code)

Response:
- `logs`: array of log entries
- `nextCursor`: optional cursor for the next page

## Common log codes (examples)

These codes are illustrative and not exhaustive:
- `HTTP_WRITE`, `HTTP_WRITE_FAILED` (audit interceptor for write requests)
- `TASK_STARTED`, `TASK_SUCCEEDED`, `TASK_FAILED`, `TASK_PAUSED`, `TASK_DELETED` (task execution)
- `WEBHOOK_REJECTED`, `WEBHOOK_ERROR`, `WEBHOOK_BIND_FAILED` (webhook processing)
- `REPO_CREATED`, `REPO_UPDATED`, `REPO_ARCHIVED`, `REPO_UNARCHIVED`, `REPO_DELETED` (repository lifecycle)
- `REPO_ROBOT_CREATED`, `REPO_ROBOT_UPDATED`, `REPO_ROBOT_DELETED` (robot lifecycle)
- `REPO_AUTOMATION_UPDATED` (automation config changes)
- `REPO_MEMBER_ROLE_UPDATED`, `REPO_MEMBER_REMOVED`, `REPO_INVITE_CREATED`, `REPO_INVITE_REVOKED`, `REPO_INVITE_ACCEPTED`
- `USER_PROFILE_UPDATED`, `USER_PASSWORD_CHANGED`, `USER_MODEL_CREDENTIALS_UPDATED`, `USER_API_TOKEN_CREATED`, `USER_API_TOKEN_UPDATED`, `USER_API_TOKEN_REVOKED`

## Stream logs (SSE)

`GET /api/logs/stream`

Streams log events via Server-Sent Events. Supports `?token=` for clients that cannot set headers.
