# Findings & Decisions: Push notifications to frontend
{/* Capture initial requirements and discovery notes. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302 */}
## Session Metadata
- **Session Hash:** push-messages-20260302
- **Created:** 2026-03-02

## Requirements
- Push messages to the frontend proactively without page refresh.
- Deliver messages only to the correct user.
- Support multiple concurrent sessions/tabs/devices for the same user.

## Research Findings
{/* Update discovery on existing notifications and SSE usage. docs/en/developer/plans/push-messages-20260302/task_plan.md push-messages-20260302 */}
- Repo root contains `backend`, `frontend`, and `shared`; message flow likely spans backend API and frontend state.
- The frontend already uses `createAuthedEventSource('/events/stream', { topics: 'notifications' })` in notifications UI components, suggesting SSE-based push is intended.
- The backend has `modules/notifications` and `modules/events/event-stream.service.ts`; `EventStreamService.publish` supports optional `userIds` filtering and `EventsController` attaches `req.user?.id` when subscribing.
- Frontend SSE helper appends `?token=` from `getToken()` to EventSource URLs, so server-side auth must populate `req.user` from query tokens for per-user filtering.
- Backend `AuthGuard` supports `AllowQueryToken` and sets `req.user` after verifying session/PAT tokens, so per-user SSE filtering should work when tokens are valid.
- `TaskGroupChatPage` only opens an `/events/stream` SSE subscription for preview-highlight topics; no general chat/task-group message stream is attached there.
- There are SSE endpoints for task logs (`/tasks/:id/logs/stream`) and system logs (`/logs/stream`), so real-time plumbing exists beyond notifications.
- The chat timeline (`TaskGroupChatPage`) refreshes task group data via polling every 5 seconds and does not receive push events for new tasks/messages.
- Task-group endpoints appear to be handled outside `tasks.controller.ts` (no `taskGroup` references there), likely in `task-groups.controller.ts`.
- `TaskGroupsController` enforces repo access for group/task listing but has no SSE endpoint; task creation happens in `TaskService.createTask` / `createTaskInGroup`, which are potential hooks for publishing push events.
- Repo membership data is handled in `RepoMemberService` and `NotificationRecipientService`; `RepoAccessService` does not expose member lists directly.
- `TaskService` creates tasks (`createTask`, `createTaskInGroup`) and updates status via `patchResult`/`retryTask`/`pauseTask`/`resumeTask` without emitting any realtime events today.
- `TaskService` currently has no constructor injection, and `TasksModule` already imports Events/Logs/Notifications modules needed for SSE/log dependencies.
- Repo root `pnpm test` runs backend + frontend tests; backend test script runs `jest -c jest.config.cjs` with Prisma generate pretest.
- The planning init-session script created plan files but reported `docs.json` missing `navigation.languages[]`; docs sync was skipped.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| init-session script error: `docs.json` missing `navigation.languages[]` | Logged; proceed without docs.json sync until needed |

## Resources
- `docs/en/developer/plans/push-messages-20260302/`
