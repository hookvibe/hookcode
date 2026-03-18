# Findings & Decisions: Add notifications system based on task results

## Session Metadata
- **Session Hash:** notify-panel-20260302
- **Created:** 2026-03-02

## Requirements
- Add notifications based on task execution results (success/failure/etc.).
- Show a compact notification panel in the top-right header with 5 latest items.
- Provide “view all” link to a settings page tab next to logs.
- Provide APIs for listing, unread count, and marking all read.
- Clear semantics = mark as read (not delete).
{/* Capture creator fallback requirement for notifications. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302 */}
- Recipients: trigger user if available, else repo owner/creator.

## Research Findings
- System logs are admin-only via `LogsService` and `LogsController` with SSE support at `/api/logs/stream`.
- Global SSE hub exists in `EventStreamService` with topic filtering and dashboard events; it can be extended to filter by user id.
- Header area uses `PageNav` and a `userPanel` slot populated by `UserPanelPopover` in `AppShell`.
- TaskRunner already emits execution logs (`TASK_SUCCEEDED`, `TASK_FAILED`, etc.), which are a natural source for notification events.
- Repo membership is managed via `RepoMemberService` and `RepoMember` model; users can be looked up by username/email via `UserService`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `Notification` model with `readAt` and `userId`. | Need per-user state and read tracking, distinct from admin system logs. |
| Add `actorUserId` to Task. | Persist trigger user resolution for notification routing, especially for manual chat tasks. |
| Use SSE topic `notifications` with per-user filtering. | Enables real-time UI updates without polling; avoids cross-user leakage. |
{/* Update fallback recipient to repo owner/creator. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302 */}
| Match trigger user by payload username/email. | Best-effort mapping for webhook users to local accounts before falling back to repo owner/creator. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| init-session.sh reported missing docs.json navigation.languages[] | Proceeded with created plan files; log error in progress/task plan. |

## Resources
- `backend/src/modules/logs/*` for log system patterns.
- `backend/src/modules/events/event-stream.service.ts` for SSE hub.
- `frontend/src/components/nav/PageNav.tsx` for header integration.
- `frontend/src/pages/AppShell.tsx` for `userPanel` composition.

## Visual/Browser Findings
- N/A (no external browsing in this task).
