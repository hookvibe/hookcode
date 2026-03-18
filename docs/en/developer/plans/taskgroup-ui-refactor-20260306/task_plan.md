# Task Plan: Refactor task group page into queued task workspace
{/* Plan the queued task workspace refactor before implementation. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}

## Session Metadata
- **Session Hash:** taskgroup-ui-refactor-20260306
- **Created:** 2026-03-06

## Goal
Refactor the task group page into a queued task workspace where the left side shows submission-style task cards without inline logs, and the right side manages preview and on-demand log tabs with a clearer task execution flow.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Map the current task group UI, data model, and task actions.
- [x] Confirm affected frontend routes, components, backend APIs, and task states.
- [x] Capture requirements, constraints, and open questions in `findings.md`.
- **Status:** complete

### Phase 2: Data Model & Interaction Design
- [x] Define the new task state model without pause/resume.
- [x] Define queue ordering, task linking, and right-side tab behavior.
- [x] Document frontend/backend contracts and migration decisions.
- **Status:** complete

### Phase 3: Frontend Refactor
- [x] Rebuild the left-side task submission workspace and task cards.
- [x] Replace inline logs with right-side tabbed preview/log panels.
- [x] Add queue action buttons and visual ordering connectors.
- **Status:** complete

### Phase 4: Backend Contract & State Updates
- [x] Update task group APIs and task status handling for queued tasks.
- [x] Exclude logs from initial task group payloads and add on-demand log fetching.
- [x] Emit audit logs for new task and queue operations.
- **Status:** complete

### Phase 5: Testing, Docs & Delivery
- [x] Add or update tests for the refactored flow.
- [x] Run targeted tests and the required full suites after test changes.
- [x] Update changelog, docs navigation, and delivery notes.
- **Status:** complete

## Key Questions
1. Which existing frontend components own the task group conversation layout, detail logs, and right-side preview panel today?
2. Which backend entities and API responses currently encode pause/resume, task ordering, and log payload inclusion?
3. How should preview tabs and multiple log tabs be keyed, restored, and closed in the new workspace?
4. What is the safest way to represent task ordering links for queued, running, stopped, and retried tasks?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with discovery across frontend and backend before proposing a state transition rewrite. | The requested UI change depends on server-side task lifecycle and payload shape. |
| Remove inline log rendering from the initial task group payload contract. | The user explicitly requires logs to load only on demand after opening a log view. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]`. | 1 | Session files were created successfully; record the docs navigation issue and update docs navigation manually if needed during delivery. |

## Notes
- Re-read this plan before changing the task lifecycle or task group response shape.
- Keep frontend text internationalized and ensure both themes still work after the layout rewrite.
- Track any build time or bundle size changes if the refactor materially expands the workspace UI.

## Design Update: 2026-03-06 17:25 CST
{/* Capture the chosen backend and frontend approach before implementation. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Introduce an explicit per-group task ordering field in the backend so queued tasks can be reordered independently from `created_at` while the UI renders clear sequence connectors.
- Replace execution-level pause/resume control with a stop flow: queued tasks stop immediately as failed, processing tasks record a stop request and finalize as failed with a manual-stop reason when the runner aborts.
- Keep the initial task-group payload lightweight by removing the page-level eager `fetchTask()` fan-out and opening task logs/details only when the right-side workspace tab is opened.
- Refactor `TaskGroupChatPage.tsx` toward a workspace model: left-side submission cards + queue actions, right-side browser-style preview/log tabs.

## Completion Notes
- Completed the backend stop-only queue contract, explicit `group_order` persistence, and manual-stop finalization flow.
- Rebuilt the TaskGroup page into a card workspace with on-demand task detail/log tabs and preview/log coexistence in the right pane.
- Added and updated frontend/backend tests, then verified `pnpm --filter hookcode-backend test`, `pnpm --filter hookcode-frontend test`, `pnpm --filter hookcode-backend build`, and `pnpm --filter hookcode-frontend build`.


## Completion Update: 2026-03-06 19:15 CST
{/* Record the completed workspace delivery scope after frontend, backend, and test validation. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- The task-group page now renders queue-oriented task cards on the left and a shared right-side tab workspace for preview, preview logs, and task execution logs.
- Manual stop replaces pause/resume end-to-end; queued tasks can be edited/reordered/deleted, processing tasks can be stopped, and stopped tasks finalize as failed with a manual-stop reason.
- Validation completed with frontend/backend builds, targeted task-group tests, and full frontend/backend test suites.
- Follow-up cleanup removed the shared log viewer pause/resume code path and extracted the task-group composer plus queue action handlers into dedicated frontend modules.
- A second frontend split extracted the preview browser surface, preview-log tab body, and workspace panel shell into dedicated task-group workspace components.
- Runtime follow-up hardens task status badges against unknown payloads and updates current Ant Design API usage for tooltip/popover teardown plus Space stacks.

## Runtime Follow-up: 2026-03-06 21:10 CST
{/* Record the post-refactor runtime stabilization work for preview empty states and sidebar polling. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Normalize `GET /api/task-groups/:id/preview/status` so missing workspaces/no-task groups return `200` with `available=false` instead of an expected `409` conflict.
- Finish the current task-page cleanup by moving `TaskGitStatusPanel` to Ant Design `Space.orientation`, which removes the remaining task-page deprecation warning.
- Reduce sidebar polling noise by backing off to the idle interval after failed refreshes and keeping those background failures out of the browser console.
- Validation for this follow-up used the PAT debug skill, a full backend build/test run, a frontend build, and targeted frontend task-page regressions after an unrelated full-frontend timeout run.


## Frontend Cleanup Follow-up: 2026-03-06 21:42 CST
{/* Record the post-delivery cleanup that extracted task-group data orchestration from the page shell. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Extract the remaining group/task data orchestration from `TaskGroupChatPage.tsx` into a dedicated hook so the page becomes a thin workspace shell.
- Remove the retired `taskLogsEnabled` prop from the task-group workspace route/test helpers because the new page no longer gates logs through that feature flag.
- Eager-load task-group skill selection when entering an existing workspace so the composer hint and skill modal are ready without a manual refresh.
- Re-run the focused frontend build/tests after the cleanup because the task-group page route and test helpers both change.

## Workspace Detail Polish: 2026-03-06 22:22 CST
{/* Record the final queue-card/log-panel polish applied after the main workspace refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Preserve Markdown formatting in task cards and right-side output panels instead of flattening execution text to plain paragraphs.
- Keep compact git-detail toggles local to the card and reopen wide-screen right panels at a fresh 50% split.

## Status Refresh Follow-up: 2026-03-06 22:40 CST
{/* Record the queued-to-processing auto-refresh fix after the homepage create flow exposed a stale task card. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Emit `task-group.refresh` immediately when `takeNextQueued()` claims queued work as `processing`, so new task-group workspaces receive the first live status transition without a hard refresh.
- Keep the frontend polling fallback alive while the visible task list still contains `queued` or `processing` work, even after the task-group SSE stream reports `ready`.
- Stabilize the frontend regression by asserting the queued-to-processing UI transition instead of an exact fetch count, because the workspace now revalidates on both SSE readiness and active-task polling.

## Stop-Abort Follow-up: 2026-03-06 23:05 CST
{/* Record the processing-task stop fix after live clone hangs ignored manual-stop requests. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Wire task abort signals into workspace shell commands so `git clone`, `git pull`, and dependency-install subprocesses terminate when users stop a processing task.
- Use process-group termination on POSIX with a forced kill fallback so shell-wrapped git commands do not leave the task stuck in `processing`.
- Add a command-abort regression that verifies streaming and silent shell commands both exit quickly when the task runner aborts them.
