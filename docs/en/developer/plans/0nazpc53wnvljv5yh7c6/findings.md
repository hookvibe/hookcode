# Findings & Decisions: Fix Live logs 404 in CI
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. 0nazpc53wnvljv5yh7c6 */}

## Session Metadata
- **Session Hash:** 0nazpc53wnvljv5yh7c6
- **Created:** 2026-01-17

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
{/* Capture the user-visible symptom and expected behavior in CI. 0nazpc53wnvljv5yh7c6 */}
- In CI deployment (`hookcode.win`), the Task detail Live logs page must not fail with `404 (Not Found)` when requesting `GET /api/tasks/:taskId/logs/stream?tail=800&token=<jwt>`.
- Live logs should connect (SSE/EventSource) and continuously show task logs, or return a clear auth/feature-disabled error instead of 404.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
{/* Record concrete code locations for the failing endpoint. 0nazpc53wnvljv5yh7c6 */}
- Frontend uses SSE/EventSource for Live logs in `frontend/src/components/TaskLogViewer.tsx` and builds `GET /api/tasks/:id/logs/stream` via `buildApiUrl(...)`.
- Backend declares a matching route `@Get(':id/logs/stream')` in `backend/src/modules/tasks/tasks.controller.ts`, so a 404 is likely caused by runtime conditions (e.g., task/logs not found) or by CI proxy/routing differences rather than missing code.
- Backend `logsStream` explicitly returns HTTP 404 JSON when `isTaskLogsEnabled()` is false (“Task logs are disabled”) or when the task id does not exist; this matches the observed `404 (Not Found)` symptom if logs are disabled in CI.
- Frontend `TaskLogViewer` passes auth via `?token=` (because `EventSource` cannot set headers) and `tail` via query; it treats any `error` event (including 404) as “Connection error. Auto reconnecting…”.
{/* Update legacy env references to the new task log toggles. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
- The task logs feature is gated by `TASK_LOGS_DB_ENABLED` and `TASK_LOGS_VISIBLE_ENABLED` (effective enablement requires both), so CI deployments return 404 when visibility is disabled.
- CI env generation script `docker/ci/write-ci-env.sh` writes `TASK_LOGS_DB_ENABLED=true` and `TASK_LOGS_VISIBLE_ENABLED=false` by default, which explains why the CI site’s Live logs endpoint 404s.
- CI Nginx config `docker/nginx/frontend.conf` does proxy `/api/*` to `backend:4000` and explicitly disables buffering for SSE (`proxy_buffering off`), so the 404 is unlikely to be caused by missing proxy rules.
{/* Correct earlier assumption: `canViewLogs` is an internal sanitization option, not an API field. 0nazpc53wnvljv5yh7c6 */}
- Backend uses `canViewLogs` only as an internal option when sanitizing task results (to hide `result.logs/logsSeq`), but the API does expose a feature flag via `/api/auth/me` → `features.taskLogsEnabled`.
- Frontend `TaskDetailPage` currently renders `<TaskLogViewer ... />` unconditionally (no `task.canViewLogs` guard), so CI environments with `TASK_LOGS_VISIBLE_ENABLED=false` will always show a failing Live logs card that spams reconnect attempts.
- Frontend chat view `TaskConversationItem` also renders `<TaskLogViewer ... />` whenever the logs panel is expanded, without checking `task.canViewLogs`.
- CI deployment helper `docker/ci/compose-build-up.sh` always generates `docker/.env` via `docker/ci/write-ci-env.sh`, so the script’s default `TASK_LOGS_VISIBLE_ENABLED=false` directly controls the deployed stack.
- The worker/agent only appends and persists log lines when `isTaskLogsEnabled()` is true (`backend/src/agent/agent.ts` returns early in `appendLine`), so in CI the logs are not only unstreamable—they are never recorded for tasks executed with logs disabled.
- Frontend i18n already has `logViewer.*` strings but does not have a dedicated “logs disabled” message yet; the Task types/requests are defined in `frontend/src/api.ts` (not a directory).
- Frontend can rely on `/api/auth/me` → `features.taskLogsEnabled` as the canonical UI feature flag; we will surface a stable “logs disabled” message instead of an endless reconnect loop when it is false.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
{/* Clarify task logs visibility defaults without legacy toggle references. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
| Enable task logs visibility in CI by default (`TASK_LOGS_VISIBLE_ENABLED=true`) | CI site is used for debugging; current default disables log capture + SSE endpoints (404). |
| Frontend renders Live logs only when `features.taskLogsEnabled=true` (or preflight `/tasks/:id/logs` passes) | Avoids confusing 404/reconnect behavior when logs are disabled; `canViewLogs` is not present in the frontend Task DTO today. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
{/* Record the reported failing URL for traceability. 0nazpc53wnvljv5yh7c6 */}
- Reported failing endpoint: `GET http://hookcode.win/api/tasks/76fd7050-1474-4cf3-a963-1f2889529364/logs/stream?tail=800&token=<jwt>`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*