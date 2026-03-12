# Findings

- GitHub Actions previously injected `HOOKCODE_DOCKER_INCLUDE_WORKER` and `HOOKCODE_SYSTEM_WORKER_*` into the Docker deployment workflow, which was the direct source of worker bootstrap/deployment behavior in CI.
- Backend bootstrap had three modes (`local`, `external`, `disabled`), but the updated requirement only needs `local` and `disabled`; treating legacy `external` values as `disabled` prevents surprise worker auto-start on older env files.
- `findEffectiveWorkerId(...)` previously fell back to offline worker rows, which conflicted with the requested "open the app and see no connected worker by default" behavior.
- The `systemManaged` concept was exposed across the backend API contract, frontend worker types, settings UI badges/action locks, worker selection ordering, and the Prisma schema.
- Local inline execution only needs `kind === 'local'`; the removed `systemManaged` gate was not required once local workers remain the only backend-started worker kind.
- The worker create API only creates remote workers, so removing the system-managed concept did not require exposing new user-created local worker flows.
- Task creation already fails fast with `WORKER_NOT_CONFIGURED` when `findEffectiveWorkerId(...)` returns `null`, so returning `null` for "no connected worker" integrates cleanly with the existing error path.
- The main Docker stack no longer needs a bundled `worker` service because the repo already ships `docker/docker-compose.remote-worker.yml` for optional dedicated worker hosts.
- Removing `system_managed` from the Prisma schema is low-risk because the field is no longer referenced by backend code or frontend contracts.
- `backend/.env.example` still documented the removed external bootstrap variables even though runtime no longer reads them, so operators could misread the default deployment model unless the example file was cleaned too.
