# Progress Log

## 2026-03-12
- Reused session `external-worker-bind-existing-20260312` after the user changed direction away from Docker/external worker bootstrap.
- Re-scanned GitHub Actions, Docker, backend worker routing/bootstrap, API DTOs, frontend worker panel, task-creation readiness checks, and worker-related docs.
- Removed the backend external worker bootstrap path and simplified worker auto-start mode parsing to `local` / `disabled`.
- Removed `systemManaged` from backend worker routing, API types, frontend worker types/UI, and the Prisma schema.
- Changed fallback worker routing to select only online workers; offline rows no longer act as implicit defaults.
- Removed the bundled `worker` service from the main Docker Compose stack and stripped GitHub Actions/CI env generation of worker deployment wiring.
- Updated README + user/API docs to describe Docker deployments as starting with no connected worker by default.
- Updated the unreleased changelog entry to match the final implementation direction.


## 2026-03-13
- Performed a final cleanup pass for residual worker wording in code comments, README files, and worker docs.
- Removed unused external bootstrap variables from `backend/.env.example` and clarified repo-level worker fallback docs so Docker/CI no longer imply a backend-owned default worker.
- Re-ran `pnpm --filter hookcode-backend build`, `docker compose -f docker/docker-compose.yml config >/dev/null`, and `docker compose --env-file docker/.env.remote-worker.example -f docker/docker-compose.remote-worker.yml config >/dev/null` after the cleanup.
- Fixed CI migration env propagation by wiring `HOOKCODE_DB_ACCEPT_DATA_LOSS` through `.github/workflows/ci.yml` and `docker/ci/write-ci-env.sh` (default `false`, opt-in via secret for intentional destructive migrations).
- Updated `docker/.env.example` and environment docs to document the destructive-migration safeguard variable and its one-time operational usage.
- Added pre-checkout git transport hardening in both CI jobs to mitigate intermittent `GnuTLS recv error (-110)` fetch failures on self-hosted runners.

## Files Changed
- `.github/workflows/ci.yml`
- `README.md`
- `README-zh-CN.md`
- `backend/package.json`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260312000200_remove_worker_system_managed/migration.sql`
- `backend/src/bootstrap.ts`
- `backend/src/modules/workers/dto/workers-swagger.dto.ts`
- `backend/src/modules/workers/local-worker-supervisor.service.ts`
- `backend/src/modules/workers/system-worker-config.ts`
- `backend/src/modules/workers/workers-internal.controller.ts`
- `backend/src/modules/workers/workers.service.ts`
- `backend/src/tests/unit/createAppAfterAuthHook.test.ts`
- `backend/src/tests/unit/systemWorkerConfig.test.ts`
- `backend/src/tests/unit/workersInternalInlineExecute.test.ts`
- `backend/src/tests/unit/workersServiceDefaultWorker.test.ts`
- `backend/src/tests/unit/workersServiceLocalWorker.test.ts`
- `backend/src/types/worker.ts`
- `docker/.env.example`
- `docker/.env.remote-worker.example`
- `docker/ci/compose-build-up.sh`
- `docker/ci/write-ci-env.sh`
- `.github/workflows/ci.yml`
- `docker/docker-compose.yml`
- `docs/en/api-reference/workers.md`
- `docs/en/change-log/0.0.0.md`
- `docs/en/user-docs/environment.md`
- `docs/en/user-docs/quickstart.md`
- `docs/en/user-docs/split-host-deployment.md`
- `docs/en/user-docs/workers.md`
- `frontend/src/api/types/workers.ts`
- `frontend/src/components/settings/SettingsWorkersPanel.tsx`
- `frontend/src/i18n/messages/en-US/ui.ts`
- `frontend/src/i18n/messages/zh-CN/ui.ts`
- `frontend/src/tests/repoDetailPage.test.tsx`
- `frontend/src/tests/settingsWorkers.test.tsx`
- `frontend/src/tests/taskGroupChatPageTestUtils.tsx`
- `docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md`
- `docs/en/developer/plans/external-worker-bind-existing-20260312/findings.md`
- `docs/en/developer/plans/external-worker-bind-existing-20260312/progress.md`
- `backend/.env.example`
- `backend/src/modules/tasks/task-runner.service.ts`
- `docs/en/user-docs/config/repositories.md`

## Test Results
- `pnpm --filter hookcode-backend test -- --runInBand --runTestsByPath src/tests/unit/systemWorkerConfig.test.ts src/tests/unit/createAppAfterAuthHook.test.ts src/tests/unit/workersServiceDefaultWorker.test.ts src/tests/unit/workersServiceLocalWorker.test.ts src/tests/unit/workersInternalInlineExecute.test.ts` ✅
- `pnpm --filter hookcode-frontend test -- src/tests/settingsWorkers.test.tsx` ✅
- `pnpm test` ⚠️ failed for pre-existing sandbox-sensitive preview tests unrelated to this change:
  - `backend/src/tests/unit/previewPortPool.test.ts` (`no_available_preview_ports`)
  - `backend/src/tests/unit/previewService.test.ts` (`EPERM` under `/Users/gaoruicheng/.hookcode/...`)
  - `backend/src/tests/unit/previewWsProxy.test.ts` (`listen EPERM` on `127.0.0.1`)
- `pnpm --filter hookcode-frontend test` ✅
- `pnpm --filter hookcode-worker test` ✅
- `pnpm --filter hookcode-backend build` ✅
- `docker compose -f docker/docker-compose.yml config >/dev/null` ✅
- `docker compose --env-file docker/.env.remote-worker.example -f docker/docker-compose.remote-worker.yml config >/dev/null` ✅
- `AUTH_TOKEN_SECRET=test-secret HOOKCODE_DB_ACCEPT_DATA_LOSS=true bash docker/ci/write-ci-env.sh /tmp/hookcode-ci.env && rg -n "HOOKCODE_DB_ACCEPT_DATA_LOSS" /tmp/hookcode-ci.env` ✅ (`"true"` written)
- `AUTH_TOKEN_SECRET=test-secret bash docker/ci/write-ci-env.sh /tmp/hookcode-ci-default.env && rg -n "HOOKCODE_DB_ACCEPT_DATA_LOSS" /tmp/hookcode-ci-default.env` ✅ (`"false"` written by default)
- `docker compose --env-file /tmp/hookcode-ci.env -f docker/docker-compose.yml config >/dev/null` ✅
- `git config --global http.version HTTP/1.1` + `http.maxRequests=2` + low-speed guard wiring in CI jobs ✅ (config-only workflow change)

## Errors Encountered
- `pnpm test` still fails in this sandbox because multiple preview-related backend tests need filesystem/socket capabilities outside the current environment. These failures were reproduced after the change but are unrelated to worker bootstrap/system-managed removal.
- Existing `createAppAfterAuthHook` tests still emit expected mocked-app console warnings (`useGlobalInterceptors`, worker WS attach, local worker supervisor). These warnings predate this change and did not fail the targeted suite.

## Completion Notes
- Docker/Actions deployments now default to `HOOKCODE_SYSTEM_WORKER_MODE=disabled` and start with no connected worker.
- Fallback routing now only auto-selects online workers.
- The user-facing/system-routing/database `systemManaged` concept has been removed.
- Dedicated Docker workers remain available through `docker/docker-compose.remote-worker.yml` after creating a worker in **Settings → Workers**.
