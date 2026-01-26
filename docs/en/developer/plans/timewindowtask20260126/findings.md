# Findings & Decisions: time windowed task execution
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. timewindowtask20260126 */}

## Session Metadata
- **Session Hash:** timewindowtask20260126
- **Created:** 2026-01-26

## Requirements
{/* Captured from user request */}
- Support hour-level time window execution for tasks (example: only run between 02:00 and 04:00).
- Configuration precedence: chat-level time window overrides trigger-level, which overrides robot-level.
- When outside the allowed window, keep the task queued, record the reason, and expose a direct-execute action/button.
- "Trigger 1" should only enqueue one task; after triggering once it remains queued waiting (with reason + direct execute) until executed.
<!-- Add follow-up UI requirement for chat composer time-window icon. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Task-group chat composer should show only a leftmost time-window icon; clicking opens selection, and only selected window is displayed inline.
<!-- Record UI tweak to avoid tooltip/popover overlap and move selectors left. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Updated composer layout to remove hover tooltip (avoids popover overlap) and keep repo/robot selectors next to the left icon.
<!-- Track latest layout adjustment moving repo/robot selectors to the right with Send. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Adjusted composer so time window stays left while repo/robot selectors group with Send on the far right.

## Research Findings
- Pending: need to inspect backend task scheduling, queue status, and existing UI fields for queue reason/direct run.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- AGENTS.md instructions for planning-with-files and inline comment requirements.

## Visual/Browser Findings
- None.

## Research Findings (2026-01-26)
- Located automation config handling in `backend/src/services/automationEngine.ts` and `backend/src/modules/repositories/repo-automation.service.ts`.
- Automation config is fetched/updated via `backend/src/modules/repositories/repositories.controller.ts` endpoints (`/repos/:id/automation`).
<!-- Record the latest session context refresh for continued implementation. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Reconfirmed active session `timewindowtask20260126` with Phase 2 in progress and remaining TODOs across backend/frontend/tests.
<!-- Track pending controller mapping check for robot time windows. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Need to verify `repositories.controller.ts` maps robot `timeWindow` fields in create/update handlers after DTO changes.
<!-- Confirm missing timeWindow handling in repositories controller for follow-up. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `repositories.controller.ts` currently has no `timeWindow` reference, so robot create/update mapping must be added manually.
<!-- Note that repo-robot service already normalizes timeWindow and expects controller input. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `repo-robot.service.ts` already normalizes `input.timeWindow`, so controller must pass through `body.timeWindow` to activate robot-level scheduling.
<!-- Confirm DTOs already expose robot timeWindow for controller mapping. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `CreateRepoRobotDto` and `UpdateRepoRobotDto` already include `timeWindow`, reinforcing the need to wire controller payload mapping.
<!-- Confirm controller patch flow still lacks timeWindow mapping. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `patchRobot` in `repositories.controller.ts` maps many fields but omits `timeWindow`, so the update payload will currently drop the new setting.
<!-- Capture createRobot payload gap for timeWindow. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `createRobot` calls `repoRobotService.createRobot` without `timeWindow`, so robot-level scheduling is not persisted yet.
<!-- Capture updateRobot payload gap for timeWindow. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `patchRobot` calls `repoRobotService.updateRobot` without `timeWindow`, so robot-level updates will ignore the new window.
<!-- Record that error mapping still needs to include timeWindow validation. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Both create/update robot error filters currently omit `timeWindow` validation messages, which would surface as 500 instead of 400.
<!-- Confirm repositories swagger DTO exposes timeWindow for robots. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `repositories-swagger.dto.ts` already exposes `timeWindow` on robot records, so API docs are aligned once controller mapping is added.
<!-- Note that execute-now endpoint already enforces queued/time-window conditions. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `/tasks/:id/execute-now` checks queued status and presence of a schedule before overriding, aligning with direct-run requirement.
<!-- Confirm RepoDetailPage includes timeWindow picker wired to form. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Repo robot editor UI renders `TimeWindowPicker` with form name `timeWindow`, so payload mapping depends on form submit logic.
<!-- Confirm robot form submit includes timeWindow payload. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `RepoDetailPage` submit logic already includes `timeWindow: values.timeWindow ?? null` in create/update payloads.
<!-- Confirm trigger rule modal persists timeWindow into rule payloads. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `TriggerRuleModal` includes `timeWindow` in the rule payload, ensuring trigger-level configuration persists.
<!-- Confirm rule summary surfaces timeWindow label. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `RepoAutomationPanel` uses `formatTimeWindowLabel` to display trigger-level time windows in rule summaries.
<!-- Note current tests and gaps for queue reason coverage. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `taskServiceListTasks.test.ts` still asserts existing queue reason codes; no scenario yet covers `outside_time_window`.
<!-- Confirm time window utility tests exist. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `timeWindow.test.ts` covers normalization and active-window evaluation including wrap-around and full-day behavior.
<!-- Note missing repo automation validation tests for timeWindow. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `repoAutomationValidation.test.ts` has no coverage for rule `timeWindow` validation yet.
<!-- Confirm automation config validation now enforces timeWindow ranges. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `validateAutomationConfigOrThrow` rejects invalid `rule.timeWindow` with code `RULE_TIME_WINDOW_INVALID`.
<!-- Note existing chat page test already includes timeWindow in execute payload. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `taskGroupChatPage.test.tsx` already asserts `executeChat` receives `timeWindow: null`.
<!-- Flag missing TasksPage test coverage for execute-now. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `tasksPage.test.tsx` does not yet cover the new queued “execute now” button for time-window blocks.
<!-- Flag missing TaskDetailPage test coverage for execute-now. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `taskDetailPage.test.tsx` still only asserts retry; needs coverage for queued `outside_time_window` execute-now UI.
<!-- Confirm TaskDetailPage uses executeNow label for time-window blocks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `TaskDetailPage` renders a `tasks.executeNow` button when `queue.reasonCode === 'outside_time_window'`.
<!-- Note frontend task tests need executeTaskNow mocks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Task page/detail tests mock `retryTask` only, so they need `executeTaskNow` mocks for new execute-now button coverage.
<!-- Confirm task service uses outside_time_window reason and schedule gating. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `task.service.ts` now resolves schedule state and uses `outside_time_window` reason + timeWindow details when blocked, and skips blocked tasks in `takeNextQueued`.
<!-- Confirm webhook handlers avoid duplicate queued tasks for trigger-level windows. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Webhook handlers resolve trigger/robot windows and call `hasQueuedTaskForRule` to prevent duplicate queued tasks when a trigger window is inactive.
<!-- Note takeNextQueued scans first 50 queued tasks to find eligible window. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- `takeNextQueued` now scans up to 50 queued tasks and skips blocked schedules until it can claim an eligible one.
<!-- Record test runners for backend/frontend. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Backend tests run via `jest -c jest.config.cjs`, frontend tests via `vitest run`.

## Research Findings (config schema)
- `RepoAutomationConfig` is normalized in `backend/src/modules/repositories/repo-automation.service.ts`, suggesting new fields should be validated/normalized there if added to automation rules or actions.
- Automation rule structure is `AutomationRule` with `actions` containing robotId/prompt overrides; changes likely require updating `backend/src/types/automation.ts` and normalization.

## Research Findings (tasks/queue)
- Task queue status and queue diagnosis live in `backend/src/types/task.ts` (`TaskQueueDiagnosis`, `TaskQueueReasonCode`) and are populated in `backend/src/modules/tasks/task.service.ts`.
- Task runner pulls queued tasks from `TaskService.takeNextQueued()` and processes serially in `backend/src/modules/tasks/task-runner.service.ts`.

## Research Findings (frontend automation)
- Automation rule editing UI lives in `frontend/src/components/repoAutomation/TriggerRuleModal.tsx` and list/summary in `frontend/src/components/repoAutomation/RepoAutomationPanel.tsx`.
- Current automation rule schema does not include time-window fields, so new time window controls likely need to be added to TriggerRuleModal and rule summary rendering.

## Research Findings (chat tasks)
- Chat tasks are created via `POST /chat` in `backend/src/modules/tasks/chat.controller.ts`, using `ChatExecuteRequestDto` and `TaskService.createTaskInGroup`.
- There is no current time-window input in `ChatExecuteRequestDto`, so chat-level scheduling will require DTO and controller changes.

## Research Findings (robots config)
- Repo robot create/update DTOs are in `backend/src/modules/repositories/dto/create-repo-robot.dto.ts` and `backend/src/modules/repositories/dto/update-repo-robot.dto.ts`.
- Repo robot schema is in `backend/prisma/schema.prisma` (model `RepoRobot`) with no existing time-window fields.

## Research Findings (automation -> tasks)
- `backend/src/services/automationEngine.ts` resolves automation rules/actions and builds prompt overrides, but currently has no scheduling/time-window logic.
- Task metadata for webhook-triggered tasks is built in `backend/src/modules/webhook/webhook.handlers.ts` (`buildTaskMeta`).

## Research Findings (task creation)
- Tasks are created as `status: 'queued'` via `TaskService.createTask` (webhook) and `createTaskInGroup` (chat) in `backend/src/modules/tasks/task.service.ts`.
- There is no existing time-window metadata in `TaskCreateMeta`, so new scheduling metadata likely needs to be added to task payload or new columns.

## Research Findings (task retry UI/API)
- Frontend already shows retry buttons for queued tasks in `frontend/src/pages/TasksPage.tsx` and `frontend/src/pages/TaskDetailPage.tsx` using `/tasks/:id/retry`.
- Backend retry endpoint sets status to queued and triggers the worker in `backend/src/modules/tasks/tasks.controller.ts`.

## Research Findings (queued UI)
- Tasks list shows queued hints via `queuedHintText(t, task)` in `frontend/src/utils/task.tsx` and renders a retry button for queued tasks in `frontend/src/pages/TasksPage.tsx`.
- Queue hint also appears in Task detail; these areas can be extended to describe time-window blocking and offer direct-run actions.

## Research Findings (task detail)
- Task detail header actions already expose Retry for queued/failed and Force Retry for processing in `frontend/src/pages/TaskDetailPage.tsx`.
- Queue diagnosis hint on the detail page uses `queuedHintText` and could be extended to show time-window reasons.

## Research Findings (API types)
- Task queue diagnosis is defined in `backend/src/modules/tasks/dto/tasks-swagger.dto.ts` and mirrored in `frontend/src/api.ts`.
- Adding a new queue reason code or additional fields requires updating both backend DTOs and frontend types/i18n.

## Research Findings (robot UI)
- Robot editor modal is in `frontend/src/pages/RepoDetailPage.tsx` and uses `RobotFormValues` to map to `updateRepoRobot`/`createRepoRobot` payloads.
- This is the place to add robot-level time window fields and validation in the UI.

## Research Findings (robot form mapping)
- Robot editor state (`RobotFormValues`) and payload mapping live in `frontend/src/pages/RepoDetailPage.tsx` (functions `buildRobotInitialValues` and `handleSubmitRobot`).
- New robot-level time window data must be stored in form state, populated from `RepoRobot`, and included in create/update payloads.

## Research Findings (repo robot backend)
- Repo robot persistence is handled by `backend/src/modules/repositories/repo-robot.service.ts`, which normalizes inputs and maps to Prisma `repo_robots` columns.
- Adding robot-level time windows requires Prisma schema changes, normalization helpers, and updates in create/update/read mappings.

## Research Findings (schema migrations)
- Database schema migrations are applied via `backend/src/db/schemaMigrations.ts` reading `backend/prisma/migrations/*/migration.sql`.
- Adding repo-robot columns requires a new Prisma migration folder and may need idempotent guards per existing tests.

## Research Findings (trigger1)
- No obvious existing "trigger1" concept found in code; webhook trigger logic is handled by automation rules in `automationEngine` and `webhook.handlers`.
- Need to interpret the "trigger1 only triggers one" requirement within automation rule handling or queue gating.

## Research Findings (hookcode config)
- `.hookcode.yml` parsing currently only covers dependency settings; no existing schedule/time-window config to reuse.

## Research Findings (webhook task creation)
- Webhook handlers call `resolveAutomationActions` and then loop over actions to create tasks via `TaskService.createTask` in `backend/src/modules/webhook/webhook.handlers.ts`.
- Automation `ruleId` is available in resolved actions but is not currently stored on the task payload; this can be leveraged to support "trigger-level" behaviors.

## Research Findings (chat payload / task group)
- Chat tasks embed console metadata in payload via `__chat` in `backend/src/services/chatPayload.ts`.
- Task groups have no scheduling fields, so chat-level time windows likely need to be stored in task payload/meta.

## Research Findings (tests)
- `backend/src/tests/unit/taskServiceListTasks.test.ts` asserts queue diagnosis reason codes; will need updates for new time-window reason.
- `backend/src/tests/unit/repoAutomationValidation.test.ts` covers automation rule validation and can be extended if time-window validation is added.

## Research Findings (frontend tests)
- `frontend/src/tests/taskDetailPage.test.tsx` asserts queued hint text and retry button behavior; will need updates for new time-window queued messaging or direct-execute controls.
- `frontend/src/tests/taskUtils.test.ts` currently focuses on terminal status and text extraction; no queue hint tests yet.

## Research Findings (chat tests)
- `frontend/src/tests/taskGroupChatPage.test.tsx` asserts the `/chat` execute payload; will need updates if chat-level time window fields are added.
- `frontend/src/tests/tasksPage.test.tsx` asserts the retry button behavior in queued state; may need updates if direct-execute replaces or augments retry.

## Technical Decisions (2026-01-26)
| Decision | Rationale |
|----------|-----------|
| Represent time windows as `{ startHour, endHour }` (hour-level) and resolve using server-local time. | Matches requirement and avoids missing timezone settings. |
| Persist robot-level time window in `repo_robots` columns; trigger/chat windows in config/payload. | Keeps robot config structured while leaving trigger/chat in JSON. |
| Store resolved schedule in task payload under `__schedule` with source metadata. | Enables queue diagnosis and worker gating without extra joins. |
| Add a manual execute-now override flag on `__schedule` and a dedicated API endpoint. | Provides required direct-execute control when blocked by time window. |

## Research Findings (migrations)
- Existing Prisma migrations are timestamped folders in `backend/prisma/migrations` and use plain `ALTER TABLE` statements.
- Schema migration tests check for fallback to `ADD COLUMN IF NOT EXISTS` when duplicate columns are detected.

## Research Findings (migration style)
- Recent migrations use simple `ALTER TABLE` statements with a short comment header.
- We should add similar comments and include the plan hash for traceability in the new migration.
