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

### Email (registration / verification)

Email providers:

- `EMAIL_PROVIDER=smtp|console|noop`

SMTP settings:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### Worker mode

Inline worker:

- `INLINE_WORKER_ENABLED=true` runs tasks in the API process.

Standalone worker:

- Set `INLINE_WORKER_ENABLED=false` and run a worker process.

