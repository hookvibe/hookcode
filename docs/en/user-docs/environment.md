---
title: Environment Variables & Config
---



HookCode uses environment variables for deployment/runtime configuration.

## Where config lives

There are three primary `.env` entry points:

- **Docker deployment (recommended)**: `docker/.env`
  - Shared by Docker Compose substitution, frontend build-time (`VITE_*`), and backend runtime.
- **Backend local dev**: `backend/.env`
  - Copy from `backend/.env.example`.
- **Frontend local dev**: `frontend/.env`
  - Copy from `frontend/.env.example`.

> The `.env.example` files are the most complete reference:
>
> - `docker/.env.example`
> - `backend/.env.example`
> - `frontend/.env.example`

## Build-time vs runtime

- Frontend variables must start with `VITE_` to be injected at build time by Vite.
- Backend variables are read at runtime.

## Core configuration (most commonly edited)

### Ports

- Docker:
  - `HOOKCODE_FRONTEND_PORT` (host → container:80)
  - `HOOKCODE_BACKEND_PORT` (host → container:4000)
  - `HOOKCODE_DB_PORT` (host → container:5432)
- Local dev:
  - `PORT` (backend, default `4000`)
  - `HOOKCODE_FRONTEND_PORT` (frontend, default `5173`)

### API base URL (frontend)

- `VITE_API_BASE_URL`
  - Docker behind a reverse proxy: commonly `/api`
  - Direct backend: `http://127.0.0.1:4000/api`

### Database (backend)

Either set `DATABASE_URL` or set the split fields:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

{/* Keep migration assets tied to the packaged backend build so HOOKCODE_WORK_DIR stays runtime-only. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
- SQL migrations always load from the packaged backend build; there is no separate env path override for migrations.

### Runtime storage

{/* Document Docker's absolute work-root requirement so `HOOKCODE_WORK_DIR` stays aligned with the mounted container volumes. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
- `HOOKCODE_WORK_DIR`: shared runtime-state root for task groups, worker runtime caches, and sticky workspaces.
- Default outside Docker: `~/.hookcode`
- Recommended Docker value: an absolute container path such as `/var/lib/hookcode`
- In the Docker Compose deployment, backend and worker each mount a separate named volume at this path.

### Auth (console + APIs)

Key variables:

- `AUTH_ENABLED`
- `AUTH_TOKEN_SECRET` (must be long and stable in production)
- `AUTH_ADMIN_USERNAME`
- `AUTH_ADMIN_PASSWORD`
- `AUTH_BOOTSTRAP_ADMIN`

Security-related note:

- `VITE_DISABLE_ACCOUNT_EDIT` is a **security boundary** enforced by the backend (not frontend-only).

### CORS

- `ALLOWED_ORIGIN`
  - Use `*` only on trusted networks.
  - Set an explicit origin list in production.

## Optional features

### Task logs

Task logs can be controlled via feature flags:

- `TASK_LOGS_DB_ENABLED`: persist logs to DB
- `TASK_LOGS_VISIBLE_ENABLED`: expose logs to users (logs API + SSE)

If logs are disabled, log endpoints can return `404` and the UI will hide log features based on `/api/auth/me` feature flags.

### Admin tools (Swagger / Prisma)

Admin tools can be enabled on separate ports:

- `ADMIN_TOOLS_ENABLED`
- `ADMIN_TOOLS_SWAGGER_PORT`
- `ADMIN_TOOLS_PRISMA_PORT`

Only expose these ports on trusted networks.

### Worker mode

{/* Document the new backend system-worker modes so source deployments, bundled Docker workers, and separately deployed remote workers share one configuration model. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
- `HOOKCODE_SYSTEM_WORKER_MODE=local`: source-mode default; backend starts its local supervised worker runtime.
- `HOOKCODE_SYSTEM_WORKER_MODE=external`: backend adopts one default external worker from env (`HOOKCODE_SYSTEM_WORKER_BIND_CODE`, `HOOKCODE_SYSTEM_WORKER_NAME`, `HOOKCODE_SYSTEM_WORKER_MAX_CONCURRENCY`).
- `HOOKCODE_SYSTEM_WORKER_MODE=disabled`: backend does not auto-provision a default worker.
- `HOOKCODE_WORKER_IMAGE` / `HOOKCODE_WORKER_IMAGE_TAG`: choose which published worker container image the Docker worker service should pull.
- `INLINE_WORKER_ENABLED` now only controls the legacy backend-inline fallback path for commandless local tasks; it is no longer the primary worker-mode switch.
