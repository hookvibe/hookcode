# Findings & Decisions: 队列任务等待原因提示与重试
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. f3a9c2d8e1b7f4a0c6d1 -->

## Session Metadata
- **Session Hash:** f3a9c2d8e1b7f4a0c6d1
- **Created:** 2026-01-19

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
<!-- Summarize user-facing requirements for queue reason and retry. f3a9c2d8e1b7f4a0c6d1 -->
- When a task stays in "queued/waiting" for a long time, the UI should show a clear reason (or best-effort diagnosis) instead of being silent.
- The task detail page should surface the reason (not only the list view).
- The queued-status area (top-right per user) should include a "Retry" button to re-trigger the task.

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
<!-- Initial discovery actions: session initialized; codebase exploration pending. f3a9c2d8e1b7f4a0c6d1 -->
- Planning session created at docs/en/developer/plans/f3a9c2d8e1b7f4a0c6d1/.
<!-- The backend queue is DB-backed and consumed serially by TaskRunner. f3a9c2d8e1b7f4a0c6d1 -->
- The task queue is DB-backed: `TaskRunner` repeatedly calls `TaskService.takeNextQueued()` and processes tasks serially.
- Queue consumption is triggered either by `backend/src/worker.ts` (standalone worker) or by INLINE_WORKER mode from webhook/tasks routes (async trigger after enqueue).
<!-- Retry already exists on backend; UI can leverage it. f3a9c2d8e1b7f4a0c6d1 -->
- Backend already exposes `POST /tasks/:id/retry` (supports `force=true` for processing tasks when stale/allowed) and triggers `TaskRunner` when `INLINE_WORKER_ENABLED` is true.
<!-- Worker mode details help explain why tasks can stay queued. f3a9c2d8e1b7f4a0c6d1 -->
- There is a standalone worker entry (`backend/src/worker.ts`) that polls every `WORKER_POLL_INTERVAL_MS` and triggers `TaskRunner` to consume queued DB tasks.
- Worker priority/backoff flags exist (`WORKER_PREFERRED`, `WORKER_BACKOFF_ON_PREFERRED`) which can intentionally pause non-preferred workers when a preferred worker is detected.
<!-- Frontend already has task list/detail pages and i18n scaffolding. f3a9c2d8e1b7f4a0c6d1 -->
- Frontend has `TasksPage.tsx` (list + status filter) and `TaskDetailPage.tsx` (detail view). i18n keys already exist for retry/delete/force-retry toasts and confirm dialogs.
<!-- Current UI only shows retry for failed, not queued. f3a9c2d8e1b7f4a0c6d1 -->
- `TaskDetailPage` currently renders header actions: retry only when `task.status === 'failed'`, and force-retry when `processing`; queued tasks have no retry action and no "why queued" hint.
<!-- Frontend API client already wraps /tasks and /tasks/:id/retry. f3a9c2d8e1b7f4a0c6d1 -->
- Frontend API client (`frontend/src/api.ts`) defines the `Task` type and already implements `retryTask(taskId, {force})` calling `POST /tasks/:id/retry`.
<!-- TaskService implementation details for queue behavior. f3a9c2d8e1b7f4a0c6d1 -->
- `TaskService.retryTask()` simply sets `status='queued'`, increments `retries`, and bumps `updatedAt` (works for queued tasks too, but will increase retry count).
- `TaskService.takeNextQueued()` claims the oldest queued task (`ORDER BY created_at ASC`) using `FOR UPDATE SKIP LOCKED`, then marks it `processing`.
- `TaskService.listTasks()` is optimized with raw SQL and sorts by `updated_at` for the console; meta is attached separately via repo/robot lookups.
<!-- i18n already includes retry-related labels/toasts that we can reuse for queued retry. f3a9c2d8e1b7f4a0c6d1 -->
- Frontend i18n already has `tasks.retry`, `toast.task.retrySuccess`, and retry-blocked/failure messages; we can reuse them when adding retry for queued tasks and add new keys only for queue-reason hints.

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| Add `task.queue` diagnosis object to Task APIs (list/get/retry) | Avoid silent queued states; provide structured data (codes + counts) for i18n-friendly UI hints. |
| Show "Retry" for queued tasks in both list and detail | Matches user request ("top-right retry") and leverages existing `POST /tasks/:id/retry` endpoint. |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
-

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->
-

---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
