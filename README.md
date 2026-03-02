<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="logo/logo-dark-text-512.png">
  <img src="logo/logo-light-text-512.png" alt="HookCode Logo" width="200">
</picture>

# HookCode

[English](README.md) | [简体中文](README-zh-CN.md)

</div>

<br/>

## Introduction

HookCode is an intelligent code review and automation platform that elegantly triggers CLI coding assistants through conversations and Webhooks. It supports independent deployment and provides a visual console for real-time task execution monitoring.

### Supported CLI Coding Assistants
- **Claude Code** - Anthropic's code assistant
- **Codex** - OpenAi's code assistant
- **Gemini** - Google's code assistant

### Supported Code Repositories
- **GitHub** - Full Webhook and API integration
- **GitLab** - Full Webhook and API integration

## Use Cases

- Review code quality after commits using your configured CLI coding assistant
- Execute build tasks after submitting requirements: fix bugs, implement features, and submit PRs to repositories
- Use your configured CLI coding assistant to reply to user questions or directly submit code after issues are created
- Evaluate merge quality using your configured CLI coding assistant after code is merged
- Multi-assistant execution: Gemini generates the design plan, Claude Code validates the execution plan, and Codex performs the implementation and build.

## Screenshots

<div align="center">

### Task Detail View
![Task Detail](screenshots/task-detail.png)

*Real-time task execution monitoring with detailed logs and results*

</div>

# Quick Start

> A publicly accessible server is required to receive repository webhooks.

<!-- Reorganize command-first quick start workflows for Docker and local development clarity. docs/en/developer/plans/readmecmd20260227/task_plan.md readmecmd20260227 -->
## Docker Deployment (Recommended)

Use Docker Compose to run **database + backend + worker + frontend** together.

### 1) Prepare environment file

```bash
cp docker/.env.example docker/.env
```

At minimum, update these keys in `docker/.env` before production use:
- `AUTH_TOKEN_SECRET`
- `AUTH_ADMIN_USERNAME`
- `AUTH_ADMIN_PASSWORD`

### 2) Build and start all services

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

### 3) Check running status and logs

```bash
docker compose -f docker/docker-compose.yml ps
```

```bash
docker compose -f docker/docker-compose.yml logs -f backend worker frontend
```

### 4) Daily operations

Restart all services:

```bash
docker compose -f docker/docker-compose.yml restart
```

Rebuild and restart only backend after backend code changes:

```bash
docker compose -f docker/docker-compose.yml up -d --build backend worker
```

Rebuild and restart only frontend after frontend code changes:

```bash
docker compose -f docker/docker-compose.yml up -d --build frontend
```

Stop and remove containers:

```bash
docker compose -f docker/docker-compose.yml down
```

Stop and remove containers + database volume:

```bash
docker compose -f docker/docker-compose.yml down -v
```

### 5) Access and defaults

- Frontend console: `http://localhost` (or `http://localhost:<HOOKCODE_FRONTEND_PORT>`)
- Backend API: `http://localhost:<HOOKCODE_BACKEND_PORT>`
- Default admin credentials come from `AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD` in `docker/.env`

### 6) Important behavior in Docker mode

- Frontend and backend run from built artifacts inside containers.
- **Source code changes on host do not hot-reload automatically.**
- After source changes, run the corresponding `up -d --build ...` command above.

### Docker configuration notes

- Docker assets are under `docker/`:
  - Compose file: `docker/docker-compose.yml`
  - Nginx reverse proxy config: `docker/nginx/frontend.conf`
  - Shared env file: `docker/.env`
- Port overrides: `HOOKCODE_FRONTEND_PORT`, `HOOKCODE_BACKEND_PORT`, `HOOKCODE_DB_PORT`
- DB credentials: `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Cloudflare single-port routing:
  - Keep `VITE_API_BASE_URL=/api`
  - Access API via `https://<your-domain>/api/...` (not `:8000`)

## Local Development

Use local dev commands when you want source-level debugging and hot reload behavior.

### 1) Install dependencies

```bash
corepack enable
pnpm install
```

### 2) Start everything

```bash
pnpm dev
```

### 3) Start by module (optional)

Database only:

```bash
pnpm dev:db
```

Backend only (default `4000`):

```bash
pnpm dev:backend
```

Frontend only (default `5173`):

```bash
pnpm dev:frontend
```

### 4) Remote database for local dev (optional)

Copy `backend/.env.example` to `backend/.env`, keep local frontend/backend ports unchanged, and point DB settings to your remote Postgres (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, or `DATABASE_URL`).

### 5) Auth and registration notes

- Login is enabled by default.
- Default credentials are in `backend/.env.example` (`AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD`).
- For production, set a strong `AUTH_TOKEN_SECRET`.
- Optional self-registration requires backend mail-related configuration (`AUTH_REGISTER_ENABLED`, `EMAIL_PROVIDER`, `SMTP_*`, `HOOKCODE_CONSOLE_BASE_URL`).

## Environment Variables

- **Backend**: `backend/.env.example`. Copy to `backend/.env` for local development or deployment (do not commit real secrets). For remote DB in development, override `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` (or set `DATABASE_URL` directly)
- **Frontend**: `frontend/.env.example` (Vite `VITE_*` variables are build-time injected; set `VITE_API_BASE_URL` to backend API base, e.g., `http://localhost:4000/api`)
- **Repository Configuration**: Robot/tokens are managed via console (database); env token fallbacks are not supported. Configure tokens per Robot/account/repository in the console

## License

MIT (see `LICENSE`).

<!-- Add a current event entry for commit/push verification. docs/en/developer/plans/readme-event-20260302/task_plan.md readme-event-20260302 -->

## Current Event

- 2026-03-02 23:44:07 +0800: Test commit to verify branch/commit/push workflow.
