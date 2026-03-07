# Findings

## Session Metadata
- **Session Hash:** worker-executor-refactor-20260307
- **Created:** 2026-03-07

## Requirements
- Replace the current inline/standalone worker split with a single external executor model.
- Start one local worker automatically with each backend instance and use it as the default execution target.
- Allow remote workers to connect to an internet-facing backend and execute commands on arbitrary machines.
- Restrict worker bootstrap/management to global admins.
- Persist which worker executed each task and task group.
- Block new work on task groups bound to offline workers, and let in-flight work fail without recovery.
- Keep provider CLIs (`codex`, `claude`, `gemini`) out of the worker package and install them on demand.

## Research Findings
- Docker and GitHub Actions configs still relied on implicit defaults for `HOOKCODE_WORK_DIR`, so backend/worker runtime data could fall back to ephemeral container layers unless operators added their own mounts.
- The Docker Compose worker service still overrode the worker image command with a stale `/repo/...` path even though the packaged worker image now builds under `/app`.
- The backend Docker image does not ship the `worker/` workspace, so Docker deployments cannot rely on the source-mode local supervisor path and must default to the external worker protocol instead.
- `backend/src/worker.ts` is a Nest application-context process that polls the DB queue and directly calls `TaskRunner.trigger()`.
- Backend still has inline execution triggers in `tasks.controller.ts`, `chat.controller.ts`, and webhook handlers via `taskRunner.trigger()` gated by `INLINE_WORKER_ENABLED`.
- `TaskRunner` currently owns the full execution lifecycle, including task log clearing, provider execution, result persistence, notifications, and finish hooks.
- `backend/src/agent/agent.ts` is tightly coupled to backend services for task-group workspace prep, repo/robot config resolution, PAT/env generation, skills sync, and provider execution.
- Real-time task logs currently flow through `TaskLogsService` + `TaskLogStreamService` + SSE; remote workers must bridge into this path through backend.
- Preview/proxy features assume local process/network access to task-group workspaces and dev servers; this cannot work transparently on remote workers in v1.
- Current schema has no worker registry tables or worker references on task/task-group/robot records.
- Frontend already has admin-gated settings tabs and repo/task-group UI surfaces where worker management and selection can be integrated.
- The new worker runtime reads `HOOKCODE_BACKEND_URL`, `HOOKCODE_WORKER_ID`, and `HOOKCODE_WORKER_TOKEN`, then derives the WebSocket connect URL locally.
- Mintlify validation still scans historical developer plan files containing legacy HTML comments, so full-doc validation remains blocked by pre-existing docs debt outside this session.
- `TasksController` now injects `WorkersConnectionService` directly, so `TasksHttpModule` must import `WorkersModule`; importing `TasksModule` alone is not enough because that provider is not re-exported there.
- The local supervised worker can fail its first WebSocket dial when backend startup uses a wildcard host such as `0.0.0.0`; the worker then exited with code 1 because initial connection errors bubbled out of `WorkerProcess.start()`.
- After the socket/auth fixes, the local worker could still fail assigned tasks because backend had not yet attached an execution command to every task envelope, producing `No task command was resolved from env or task payload.`
- Backend task groups and worker runtime/workspace directories were still configured through separate env vars (`HOOKCODE_TASK_GROUPS_ROOT`, `HOOKCODE_WORKER_RUNTIME_DIR`, `HOOKCODE_WORKER_WORKSPACE_ROOT`), which caused repo-root clutter and made storage harder to manage.
- Runtime-data path overrides such as `HOOKCODE_AUTH_TOKEN_SECRET_FILE` were still resolved from `process.cwd()` and did not share the new `HOOKCODE_WORK_DIR` semantics.
- `HOOKCODE_MIGRATIONS_DIR` blurred the boundary between runtime state and packaged schema assets, so keeping it made `HOOKCODE_WORK_DIR` semantics harder to reason about.
- Operators now need two explicit Docker entrypoints: the bundled all-in-one stack for simple installs and a dedicated remote-worker compose/env pair for split-host deployments.
- A standalone split-host runbook is needed because quickstart snippets are not enough for operators who must sequence backend-first bootstrap, worker token reuse, and cross-host verification.
- The worker-create modal previously collapsed all backend `400` responses into one generic toast, and whitespace-only names passed the Ant Design `required` rule because the field was not trimmed before validation.
- The worker-create modal was using `validateFields()` directly from the Modal OK handler instead of the repo-standard `form.submit() -> onFinish` flow, which can race with the latest input/IME composition state and produce empty names even when the textbox looks filled.
- The backend `workers` request DTOs only had Swagger decorators, so Nest `ValidationPipe({ whitelist: true })` stripped `name`, `status`, `maxConcurrency`, and `providers` from incoming bodies before the controller saw them.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Backend will build an execution envelope and remain the only component with business DB access. | Avoids duplicating backend service logic inside the worker package. |
| Backend will store task logs after receiving worker log batches, then re-publish via the existing SSE path. | Preserves the current frontend log transport and pagination model. |
| Task-group worker selection will be immutable after the group starts executing. | Prevents cross-worker workspace divergence. |
| Remote workers will require secure WebSocket transport when connecting to non-local backends. | Protects git/provider credentials sent inside execution envelopes. |
| The local system-managed worker may fall back to backend-inline execution when a task envelope still lacks a runnable command. | Keeps the default backend-owned worker operational while the remote-safe execution envelope is completed incrementally. |
| Consolidate backend task-group storage and worker runtime/workspace storage under `HOOKCODE_WORK_DIR` with default `~/.hookcode`. | Gives operators one storage root to manage and keeps local backend/worker paths aligned. |
| Keep `HOOKCODE_WORK_DIR` focused on runtime state while deleting `HOOKCODE_MIGRATIONS_DIR` and leaving schema migrations on the packaged backend path. | Removes path ambiguity and keeps migration assets versioned with the shipped backend build. |
| Ship a dedicated remote-worker compose/env example alongside the main Docker stack. | Lets operators deploy backend and executor hosts separately without manually reconstructing worker container settings. |

| Make Docker Compose and GitHub Actions emit explicit `HOOKCODE_WORK_DIR` values and mount persistent backend/worker volumes at that path. | Ensures container deployments keep runtime state across rebuilds and makes the Docker-specific absolute-path requirement visible to operators. |
| Add configurable system-worker modes so source deployments use the local supervisor while Docker/production deployments can bootstrap a default external worker from env. | Keeps one-click Docker usable for regular users while letting server deployments shift backend to remote-worker-only execution through secrets/vars. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]`. | Proceed with manual planning file updates and later decide whether docs navigation needs a compatibility fix for the current Mintlify config format. |
| `pnpm --filter hookcode-docs build` calls `mintlify build`, but the installed Mintlify CLI exposes `validate` instead of `build`. | Recorded as pre-existing docs-tooling mismatch and used `npx mintlify validate` as the closest available validation command. |
| `npx mintlify validate` still fails after current-page fixes because many historical developer plan files under `docs/en/developer/plans/` still contain legacy HTML comments. | Kept this session's user/API docs MDX-safe and recorded the broader docs debt instead of bulk-editing unrelated historical plan logs. |
| Local worker task execution still failed after the connectivity fixes because commandless tasks were dispatched before the new worker envelope builder was complete. | Added a guarded backend-inline fallback path that only the supervised local worker can use, and taught the worker runtime to skip duplicate finalization for that path. |

## Resources
- `backend/src/worker.ts`
- `backend/src/modules/tasks/task-runner.service.ts`
- `backend/src/modules/tasks/task.service.ts`
- `backend/src/modules/workers/workers.controller.ts`
- `backend/src/modules/workers/workers-internal.controller.ts`
- `worker/src/config.ts`
- `worker/src/workerProcess.ts`
- `frontend/src/pages/TaskGroupChatPage.tsx`
- `frontend/src/pages/RepoDetailPage.tsx`
- `frontend/src/pages/UserSettingsPage.tsx`
- `docs/docs.json`
