# Progress Log

## 2026-03-12
- Initialized session `external-worker-bind-existing-20260312` with the file-context-planning workflow.
- Investigated GitHub Actions, Docker compose, backend bootstrap, and worker-selection code paths for external worker mode.
- Replaced backend external-worker bootstrap with credential-based binding to an existing remote worker row.
- Updated Docker/user docs to explain that `external` mode now binds an existing worker instead of auto-creating one.
- Added unit coverage for config parsing, worker binding success/failure paths, and bootstrap log behavior.
- Updated the unreleased changelog entry.

## Files Changed
- `backend/src/bootstrap.ts`
- `backend/src/modules/workers/system-worker-config.ts`
- `backend/src/modules/workers/workers.service.ts`
- `backend/src/tests/unit/createAppAfterAuthHook.test.ts`
- `backend/src/tests/unit/systemWorkerConfig.test.ts`
- `backend/src/tests/unit/workersServiceExternalBinding.test.ts`
- `docker/.env.example`
- `docs/en/user-docs/environment.md`
- `docs/en/user-docs/workers.md`
- `docs/en/user-docs/split-host-deployment.md`
- `docs/en/change-log/0.0.0.md`
- `docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md`
- `docs/en/developer/plans/external-worker-bind-existing-20260312/findings.md`
- `docs/en/developer/plans/external-worker-bind-existing-20260312/progress.md`

## Test Results
- `pnpm --filter hookcode-backend test -- --runInBand --runTestsByPath src/tests/unit/systemWorkerConfig.test.ts src/tests/unit/createAppAfterAuthHook.test.ts src/tests/unit/workersServiceExternalBinding.test.ts` ✅
- `pnpm test` ✅
- `pnpm --filter hookcode-backend build` ✅

## Errors Encountered
- `bash .codex/skills/file-context-planning/scripts/init-session.sh ...` printed `ERROR: docs.json missing navigation.languages[]` after creating the session files. No recovery needed for this task because the session folder was created successfully and `docs/docs.json` uses `navigation.tabs`.
- The first targeted backend test command used repo-root paths (`backend/src/tests/...`) inside the filtered backend package, so Jest returned `No tests found`; reran with package-relative paths (`src/tests/...`) and the tests passed.
- Existing `createAppAfterAuthHook` tests still emit expected mocked-app console warnings (`useGlobalInterceptors`, worker WS attach, local worker supervisor). These warnings predate this change and did not fail the suite.

## Completion Notes
- External mode now requires an existing remote worker entry with matching id/token.
- Backend preserves the existing worker name/max concurrency instead of overwriting them from env.
- Other remote `systemManaged` rows are demoted when binding the configured worker.
