# Progress Log

## Session Metadata
- **Session Title:** External worker executor refactor
- **Session Hash:** worker-executor-refactor-20260307

## Session: 2026-03-07
### Phase 1: Requirements & Discovery
- **Status:** complete
- **Started:** 2026-03-07 19:00
- Actions taken:
  - Reviewed the current backend worker entrypoint, task runner, task service, chat/webhook triggers, preview services, and frontend task/repo/settings surfaces.
  - Confirmed the lack of a worker registry model and the current inline-worker trigger behavior.
  - Captured architecture decisions for a pure external worker protocol with backend-managed dispatch.
- Files created/modified:
  - `docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/findings.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/progress.md`

### Phase 2: Planning & Structure
- **Status:** complete
- Actions taken:
  - Defined the external worker architecture, task-group worker locking, local-worker preview boundary, and log bridge approach.
  - Confirmed admin-only worker management should live under the settings experience.
- Files created/modified:
  - `docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/findings.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/progress.md`

### Phase 3: Implementation
- **Status:** complete
- Actions taken:
  - Added worker registry schema, worker DTOs/types, admin worker APIs, internal worker APIs, connection tracking, and local-worker supervision in the backend.
  - Added the standalone `worker/` workspace, protocol client, runtime bootstrap/install flow, and task execution envelope handling.
  - Updated frontend settings, repo robot editor, chat composer, task/task-group surfaces, i18n messages, and API types to expose worker management plus worker routing metadata.
  - Added user/API docs for the new worker model and updated navigation.
- Representative files created/modified:
  - `backend/src/modules/workers/`
  - `backend/src/modules/tasks/task-runner.service.ts`
  - `backend/src/modules/tasks/task.service.ts`
  - `worker/src/`
  - `frontend/src/components/settings/SettingsWorkersPanel.tsx`
  - `frontend/src/components/workers/WorkerSummaryTag.tsx`
  - `frontend/src/pages/RepoDetailPage.tsx`
  - `frontend/src/pages/TaskGroupChatPage.tsx`
  - `docs/en/user-docs/workers.md`
  - `docs/en/user-docs/split-host-deployment.md`
  - `docs/en/user-docs/environment.md`
  - `docs/en/api-reference/workers.md`

### Phase 4: Testing & Verification
- **Status:** complete
- Actions taken:
  - Ran package builds for frontend, worker, and backend.
  - Added/updated frontend tests for worker settings, repo default worker selection, and chat worker overrides.
  - Updated backend unit tests to the new worker-dispatch model and DI signatures.
  - Ran the full repository test suite after test updates.
- Files created/modified:
  - `frontend/src/api/client.ts`
  - `frontend/src/components/settings/SettingsWorkersPanel.tsx`
  - `frontend/src/tests/settingsWorkers.test.tsx`
  - `frontend/src/tests/taskGroupChatPage.composer.test.tsx`
  - `frontend/src/tests/repoDetailPage.test.tsx`
  - `backend/src/tests/unit/chatController.test.ts`
  - `backend/src/tests/unit/taskLogsFeatureToggle.test.ts`
  - `backend/src/tests/unit/taskRunnerFinalize.test.ts`
  - `backend/src/tests/unit/taskServiceListTasks.test.ts`
  - `backend/src/tests/unit/tasksVolumeByDayController.test.ts`

### Phase 5: Delivery
- **Status:** complete
- Actions taken:
  - Applied a follow-up NestJS DI fix after runtime startup reported `TasksHttpModule` could not resolve `WorkersConnectionService` for `TasksController`.
  - Fixed local worker startup resilience so wildcard backend hosts are normalized to loopback and initial WebSocket dial failures no longer terminate the worker process.
  - Imported `WorkersModule` directly into `TasksHttpModule` and verified the built module can compile in a runtime Nest testing context.
  - Verified the updated package builds/tests and documented the remaining docs-tooling validation blockers.
  - Updated the unreleased changelog entry and finalized this session's plan/findings/progress files.
- Added a guarded backend-inline fallback for the local system-managed worker so commandless tasks no longer fail immediately after assignment.
- Taught the worker runtime to skip duplicate finalization when backend handles the local inline fallback path.
- Added backend + worker regression tests covering local inline execution delegation and local-only authorization.
- Consolidated backend task-group storage and worker runtime/workspace storage under a single `HOOKCODE_WORK_DIR` root that defaults to `~/.hookcode`.
- Updated the local worker supervisor to pass the resolved work root into the child worker so relative overrides stay consistent across backend and worker processes.
- Kept `HOOKCODE_AUTH_TOKEN_SECRET_FILE` on the shared work-dir path resolver while removing `HOOKCODE_MIGRATIONS_DIR` so schema assets no longer masquerade as runtime storage.
- Updated env/user docs to explain that `HOOKCODE_WORK_DIR` is runtime-only and backend SQL migrations always follow the packaged backend build.
- Added explicit `HOOKCODE_WORK_DIR` wiring to Docker Compose, CI env generation, GitHub Actions, and deployment docs, plus persistent backend/worker named volumes at the configured container path.
- Fixed the Docker Compose worker service command override so the packaged worker image now starts from `/app/dist/main.js` instead of the stale monorepo source path.
- Added backend system-worker mode parsing plus external bootstrap registration so source mode can keep the local supervisor while Docker/production defaults to an env-configured external worker.
- Updated default worker selection to prefer reachable system workers, preventing stale offline local rows from blocking Docker/production external-worker routing.
- Wired Docker Compose, CI env generation, and GitHub Actions secrets/vars to the new `HOOKCODE_SYSTEM_WORKER_*` / `HOOKCODE_DOCKER_INCLUDE_WORKER` settings so regular users still get one-command Docker while server deployments can wait for separately deployed remote workers.
- Files created/modified:
  - `backend/src/db.ts`
  - `backend/src/tests/unit/workDir.test.ts`
  - `backend/.env.example`
  - `backend/src/modules/workers/system-worker-config.ts`
  - `backend/src/modules/workers/workers.service.ts`
  - `backend/src/modules/workers/dto/workers-swagger.dto.ts`
  - `backend/src/tests/unit/workersRequestDto.test.ts`
  - `backend/src/bootstrap.ts`
  - `backend/src/modules/tasks/task.service.ts`
  - `backend/src/tests/unit/systemWorkerConfig.test.ts`
  - `backend/src/tests/unit/workersServiceDefaultWorker.test.ts`
  - `docker/docker-compose.yml`
  - `docker/docker-compose.remote-worker.yml`
  - `docker/.env.example`
  - `docker/.env.remote-worker.example`
  - `docker/ci/write-ci-env.sh`
  - `.github/workflows/ci.yml`
  - `README.md`
  - `README-zh-CN.md`
  - `docs/en/user-docs/quickstart.md`
  - `docs/en/user-docs/environment.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/findings.md`
  - `docs/en/developer/plans/worker-executor-refactor-20260307/progress.md`
  - `docs/en/change-log/0.0.0.md`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Frontend build | `pnpm --filter hookcode-frontend build` | Frontend compiles after worker UI/API changes | Passed | ✓ |
| Worker build | `pnpm --filter hookcode-worker build` | Standalone worker compiles | Passed | ✓ |
| Backend build | `pnpm --filter hookcode-backend build` | Backend compiles after worker refactor | Passed | ✓ |
| Worker tests | `pnpm --filter hookcode-worker test` | Worker config/command tests pass | Passed (2 suites / 7 tests) | ✓ |
| Frontend tests | `pnpm --filter hookcode-frontend test` | Frontend worker UI and existing pages stay green | Passed (36 files / 174 tests) | ✓ |
| Backend tests | `pnpm --filter hookcode-backend test` | Backend worker dispatch and existing APIs stay green | Passed (101 suites / 418 tests) | ✓ |
| Full repository test suite | `pnpm test` | All package test suites pass together | Passed | ✓ |
| Docs validation (closest available) | `cd docs && npx mintlify validate` | Validate user/API docs | Failed because historical plan docs still contain legacy HTML comments outside this session | partial |
| Runtime module compile check | `node` + `@nestjs/testing` on `backend/dist/modules/tasks/tasks-http.module` | `TasksHttpModule` compiles with resolved worker DI | Passed (`tasks-http-module-ok`) | ✓ |
| Worker reconnect regression test | `pnpm --filter hookcode-worker test -- --runInBand src/__tests__/workerProcess.test.ts src/__tests__/config.test.ts` | Worker survives first dial failure and retries | Passed | ✓ |
| Local supervisor loopback regression test | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/localWorkerSupervisor.test.ts` | Wildcard backend URLs normalize to loopback | Passed | ✓ |
| Local inline fallback backend tests | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/taskRunnerFinalize.test.ts src/tests/unit/workersInternalInlineExecute.test.ts src/tests/unit/workersInternalControllerAuth.test.ts` | Local inline fallback stays guarded and releases worker slots | Passed | ✓ |
| Local inline fallback worker tests | `pnpm --filter hookcode-worker test -- --runInBand src/__tests__/taskExecution.test.ts src/__tests__/taskCommand.test.ts src/__tests__/workerProcess.test.ts` | Local worker delegates commandless tasks without double finalization or log writes | Passed | ✓ |
| Backend + worker rebuild after fallback fix | `pnpm --filter hookcode-backend build && pnpm --filter hookcode-worker build` | Compile the fallback path in real package builds | Passed | ✓ |
| Unified work-dir backend tests | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/buildRootResolution.test.ts src/tests/unit/localWorkerSupervisor.test.ts` | Backend task-group roots and local worker path injection follow `HOOKCODE_WORK_DIR` | Passed | ✓ |
| Unified work-dir worker tests | `pnpm --filter hookcode-worker test -- --runInBand src/__tests__/config.test.ts` | Worker runtime/workspace paths derive from `HOOKCODE_WORK_DIR` | Passed | ✓ |
| Unified work-dir backend + worker builds | `pnpm --filter hookcode-backend build && pnpm --filter hookcode-worker build` | Compile the new shared work-dir plumbing | Passed | ✓ |
| Runtime-data work-dir backend tests | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/workDir.test.ts src/tests/unit/buildRootResolution.test.ts src/tests/unit/authTokenSecretFileFallback.test.ts src/tests/unit/localWorkerSupervisor.test.ts` | Auth-secret/task-group paths honor `HOOKCODE_WORK_DIR` semantics while migrations stay on the packaged backend path | Passed | ✓ |
| Runtime-data work-dir worker tests | `pnpm --filter hookcode-worker test -- --runInBand src/__tests__/config.test.ts` | Worker runtime/workspace defaults still follow `HOOKCODE_WORK_DIR` | Passed | ✓ |
| Runtime-data work-dir backend + worker builds | `pnpm --filter hookcode-backend build && pnpm --filter hookcode-worker build` | Compile the unified path resolver changes | Passed | ✓ |
| Migration override removal verification | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/workDir.test.ts src/tests/unit/authTokenSecretFileFallback.test.ts src/tests/unit/buildRootResolution.test.ts && pnpm --filter hookcode-backend build` | Backend keeps runtime-data overrides working after deleting `HOOKCODE_MIGRATIONS_DIR` | Passed | ✓ |
| Docker work-dir config validation | `bash -n docker/ci/write-ci-env.sh && AUTH_TOKEN_SECRET=test HOOKCODE_WORK_DIR=/var/lib/hookcode bash docker/ci/write-ci-env.sh /tmp/hookcode-docker.env && docker compose --env-file docker/.env.example -f docker/docker-compose.yml config` | Docker/CI configs emit explicit `HOOKCODE_WORK_DIR` values and mount valid persistent volumes | Passed (including relative-path guard check) | ✓ |
| System-worker mode verification | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/systemWorkerConfig.test.ts src/tests/unit/workersServiceDefaultWorker.test.ts src/tests/unit/createAppAfterAuthHook.test.ts src/tests/unit/localWorkerSupervisor.test.ts src/tests/unit/buildRootResolution.test.ts src/tests/unit/authTokenSecretFileFallback.test.ts && pnpm --filter hookcode-backend build && AUTH_TOKEN_SECRET=test HOOKCODE_WORK_DIR=/var/lib/hookcode HOOKCODE_SYSTEM_WORKER_MODE=external HOOKCODE_SYSTEM_WORKER_TOKEN=remote-secret bash docker/ci/write-ci-env.sh /tmp/hookcode-docker.env && docker compose --env-file docker/.env.example -f docker/docker-compose.yml config` | Backend system-worker modes, Docker bundled-worker envs, and remote-worker-only CI deployments stay valid together | Passed | ✓ |
| Dedicated remote-worker Docker asset validation | `docker compose --env-file docker/.env.remote-worker.example -f docker/docker-compose.remote-worker.yml config` | Dedicated worker hosts render with the documented env/volume defaults | Passed | ✓ |
| Split-host deployment docs wiring check | `docker compose --env-file docker/.env.remote-worker.example -f docker/docker-compose.remote-worker.yml config && rg -n "split-host-deployment" docs/docs.json docs/en/user-docs/index.md docs/en/user-docs/workers.md docs/en/user-docs/quickstart.md` | The new deployment guide is navigable and stays aligned with the remote-worker Docker assets | Passed | ✓ |
| Worker create localhost error UX fix | `pnpm --filter hookcode-frontend exec vitest run src/tests/settingsWorkers.test.tsx && pnpm --filter hookcode-frontend build` | Worker creation surfaces backend validation details and blocks whitespace-only names before the POST request | Passed | ✓ |
| Worker request DTO whitelist fix | `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/workersRequestDto.test.ts && pnpm --filter hookcode-backend build` | Worker create/update/prepare request bodies survive ValidationPipe whitelist stripping | Passed | ✓ |
| CI frozen-lockfile repair | `pnpm install --lockfile-only && pnpm install --frozen-lockfile --ignore-scripts` | Workspace install succeeds after syncing `worker/package.json` specs into `pnpm-lock.yaml` | Passed | ✓ |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-07 19:03 | `init-session.sh` failed with `docs.json missing navigation.languages[]` | 1 | Continued with manual updates to session planning files and recorded the compatibility issue in findings. |
| 2026-03-07 02:33 | `pnpm --filter hookcode-docs build` failed because the current script runs `mintlify build`, which is not supported by the installed Mintlify CLI. | 1 | Used `npx mintlify validate` as the closest available docs validation command and recorded the tooling mismatch. |
| 2026-03-07 02:35 | `npx mintlify validate` still failed after current-page fixes because many legacy developer plan docs use HTML comments. | 1 | Left unrelated historical plan files untouched, converted this session's user/API docs to MDX-safe comments, and documented the remaining docs debt in findings. |
| 2026-03-07 13:54 | Backend startup failed because `TasksHttpModule` did not import `WorkersModule`, leaving `TasksController` without `WorkersConnectionService`. | 1 | Imported `WorkersModule` into `TasksHttpModule`, rebuilt the backend, and verified runtime module compilation against `dist`. |
| 2026-03-07 14:00 | Tasks failed with `Assigned worker went offline (process_exit:1)` right after dispatch because the local worker dialed a wildcard backend host and exited on first WebSocket failure. | 1 | Normalized local worker backend URLs to loopback and changed worker startup to keep retrying after initial dial failures instead of exiting. |
| 2026-03-07 14:12 | Tasks still failed after the connection fixes with `No task command was resolved from env or task payload.` because commandless local tasks reached the new worker runtime before the execution envelope was complete. | 1 | Added a guarded backend-inline fallback for the supervised local worker and skipped duplicate worker finalization on that path. |
| 2026-03-07 16:40 | Creating a remote worker on localhost returned `400 Bad Request`, but the settings panel only showed a generic failure toast, making the actual validation problem invisible. | 1 | Surfaced backend `error/message` payloads in the worker panel and trimmed the name field during client-side validation so whitespace-only names are blocked before the request. |
| 2026-03-07 16:48 | The worker-create modal still returned `name is required` after users typed a visible name because the Modal OK handler could submit before the latest input/IME composition state had flushed into the Ant Design form. | 1 | Switched the modal to the repo-standard `createForm.submit()` plus `Form onFinish` flow and kept backend error details visible so typed names now submit reliably. |
| 2026-03-07 16:56 | `POST /api/workers` still returned `name is required` even with a valid request payload because the backend DTO only had Swagger decorators and Nest whitelist validation stripped all body fields. | 1 | Added `class-validator`/`class-transformer` decorators to the worker request DTOs and locked the behavior with a ValidationPipe unit test. |
| 2026-03-07 17:10 | GitHub Actions failed at `pnpm install --frozen-lockfile` because `worker/package.json` declared `ts-node` while `pnpm-lock.yaml` still reflected the older worker specifier set. | 1 | Regenerated `pnpm-lock.yaml` from the workspace and rechecked frozen install locally so CI can install before running tests. |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Delivery complete |
| Where am I going? | Hand off the worker refactor with notes about remaining docs-tooling debt |
| What's the goal? | Move task execution to a standalone external worker model with backend-managed dispatch and UI management |
| What have I learned? | The worker runtime now drives execution through backend-owned internal APIs, while docs validation is still blocked by historical MDX comment debt |
| What have I done? | Implemented backend/worker/frontend/docs changes, updated tests, and verified builds plus the full repository test suite |
