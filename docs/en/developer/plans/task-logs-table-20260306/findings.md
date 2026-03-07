# Findings & Decisions: Task log table + pagination
{/* Summarize discoveries and decisions for task log split. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306 */}

## Session Metadata
- **Session Hash:** task-logs-table-20260306
- **Created:** 2026-03-06

## Requirements
- Split task execution logs out of `tasks.result_json` into a dedicated table with indexes.
- Provide paginated log access in the UI (latest + load earlier).
- Make TaskGroup timeline loading chained: current task logs must exhaust before older tasks are revealed.
- Keep SSE live log streaming functional.
- Migrate historical `result_json.logs`/`logsSeq` into the new table and remove the JSON fields.
- Add tests and update the API docs.

## Research Findings
- Backend currently stores logs in `tasks.result_json.logs` and uses `logsSeq` to drive SSE polling.
- Agent caps logs in memory (`MAX_LOG_LINES`) and persists via `patchResult`.
- Frontend log viewer uses `GET /tasks/:id/logs/stream` SSE only; no REST pagination exists.
- `TaskService.hasTaskGroupLogs` queries `result_json` and must switch to the new table.
- TaskGroup chat previously mounted multiple `TaskLogViewer` instances at once (latest task page), which still caused heavy page load for long groups.
- Chained loading can deadlock if the active task never emits SSE `init` (for example stream error before initialization), because the parent never receives a history-exhausted signal.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Create `task_logs` with `(task_id, seq)` unique + indexes | Enables fast paged reads and avoids bloated JSON payloads. |
| Introduce `TaskLogsService` for read/write | Centralizes log storage logic for agent + controller usage. |
| SSE init payload includes `startSeq/endSeq/nextBefore` | Allows UI to show "load earlier" reliably. |
| Replace fixed task-page loading with chained task/log loading in `TaskGroupChatPage` | Ensures only one task log viewer paginates at a time and reveals older tasks progressively. |
| Add `TaskLogViewer` HTTP bootstrap fallback after SSE errors before init | Guarantees chained pagination can continue even when a task log stream fails to initialize. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| init-session.sh reported missing docs.json navigation.languages[] | Continue with session files; skip docs.json sync for now. |
| Chained loading stalled when active task log stream failed before init | Bootstrap initial paging state via `/tasks/:id/logs` on SSE error, then mark history initialized. |

## Resources
- `backend/prisma/schema.prisma`
- `backend/src/agent/agent.ts`
- `backend/src/modules/tasks/tasks.controller.ts`
- `frontend/src/components/TaskLogViewer.tsx`
- `docs/en/api-reference/tasks-and-groups.md`
