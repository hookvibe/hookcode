---
title: Notifications
---
{/* Document user notification APIs for task alerts. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302 */}

This page documents the per-user notification APIs used by the console header panel and settings tab.

## Notification schema

Each notification contains:
- `id` (string)
- `userId` (string)
- `type` (`TASK_SUCCEEDED` | `TASK_FAILED` | `TASK_STOPPED` | `TASK_DELETED`)
- `level` (`info` | `warn` | `error`)
- `message` (string)
- `code` (string, optional)
- `repoId` (string, optional)
- `taskId` (string, optional)
- `taskGroupId` (string, optional)
- `linkUrl` (string, optional): the primary notification destination; in-app pages use relative hash URLs like `#/tasks/<id>`, while external targets keep their original absolute URL. <!-- Document notification link targets for in-app hashes and external absolute URLs. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9 -->
- `meta` (object, optional)
- `readAt` (ISO timestamp, optional)
- `createdAt` (ISO timestamp)

## List notifications

`GET /api/notifications`

Query params:
- `limit` (number, optional): page size (default 20)
- `cursor` (string, optional): pagination cursor from the previous response
- `unread` (true | false, optional): filter unread only

Response:
- `notifications`: array of notification entries
- `nextCursor`: optional cursor for the next page

## Unread count

`GET /api/notifications/unread-count`

Response:
- `count`: number of unread notifications

## Mark all read

`POST /api/notifications/read-all`

{/* Clarify clear semantics for notifications. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302 */}
Note: the console “clear/read all” action marks notifications as read; it does not delete records.

Response:
- `updated`: number of notifications marked read
- `readAt`: ISO timestamp when the mark-all occurred

## Real-time updates (SSE)

`GET /api/events/stream?topics=notifications`

Events:
- `notification`: emitted when a new notification is created
- `notifications.read_all`: emitted when the current user marks all notifications as read
