# Findings
{/* Record CI backend deploy investigation findings. docs/en/developer/plans/ci-backend-start-20260310/task_plan.md ci-backend-start-20260310 */}

- User report: GitHub Actions deploy logs show docker compose build/up succeeded, but backend is not running on server after deploy.
- Server `docker ps` shows only `hookcode-frontend-1` and `hookcode-db-1`; backend container is absent, implying it exited or failed to start.
- Session init script created planning files but failed to sync docs navigation: `ERROR: docs.json missing navigation.languages[]`.

## Open Questions
- What is the backend container exit reason (`docker compose logs backend`)?
- Is the backend service name or profile disabled in the compose file used by `docker/ci/compose-build-up.sh`?
- Are required env vars for backend missing or failing healthcheck, causing it to exit?
- Located CI script `docker/ci/compose-build-up.sh` and `docker/ci/write-ci-env.sh` in repo.
- `docker/ci/compose-build-up.sh` always includes `backend` in services array; only `worker` is optional via `HOOKCODE_DOCKER_INCLUDE_WORKER`.
- `docker/ci/write-ci-env.sh` can `exit 1` if required auth/worker env vars are missing, but CI log shows compose up completed, so env generation likely succeeded.
- `docker/docker-compose.yml` defines `backend` service with port binding `${HOOKCODE_BACKEND_BIND:-127.0.0.1}:${HOOKCODE_BACKEND_PORT:-4000}:4000` and depends on `db`.
- Compose file exists under `docker/` but there are no Dockerfiles under `docker/` itself; Dockerfiles live at repo root paths (`backend/Dockerfile`, `frontend/Dockerfile`, `worker/Dockerfile`).
- Backend image runs `node dist/main.js` directly (no custom entrypoint), so any runtime error will exit the container immediately.
- `backend/src/main.ts` exits process with code 1 if `bootstrapHttpServer` throws, so startup failure will stop the container immediately; logs should show `[backend] failed to start`.
- Backend bootstrap calls `ensureSchema()` before Nest app init; DB connection or migration failure there would throw and stop startup.
- In external worker mode, backend bootstraps a system worker from env; missing/invalid worker token or config could throw during `readExternalSystemWorkerConfig` or `ensureExternalSystemWorker`.
- `ensureSchema` implementation lives in `backend/src/db.ts` (no `backend/src/db/index.ts`).
- `ensureSchema()` auto-migrates by default but will throw if migrations are pending and `HOOKCODE_DB_AUTO_MIGRATE=false`, or if migration checksums mismatch.
- External worker mode is strict: `readExternalSystemWorkerConfig` throws if `HOOKCODE_SYSTEM_WORKER_ID` is not a UUID or if `HOOKCODE_SYSTEM_WORKER_TOKEN` is empty.
- Backend exposes health endpoint via `HealthController` at `/health` (with global prefix `api`, so `/api/health`), and `AUTH_EXEMPT_HEALTH` defaults to true.
- DB schema retry defaults: 3 attempts, 1s base delay, only retries transient connection codes; non-transient errors fail fast.
- `/api/health` pings DB; suitable for container healthcheck to verify DB connectivity.
- Re-read task plan and findings before deciding on deployment health checks.
- Backend crash reason from server logs: external system worker ID already owned by a non-system remote worker, causing `ensureExternalSystemWorker` to throw and exit.
- `docs/en/change-log/0.0.0.md` contains the Unreleased entries and needs a new bullet for this session.
- `docs/en/change-log/AGENTS.md` confirms `0.0.0.md` is the Unreleased placeholder; added entry there is appropriate.
