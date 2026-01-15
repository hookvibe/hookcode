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

> A publicly accessible server is required to receive the repository's webhook.

## Docker Deployment (Recommended)

**Recommended: Use Docker Compose to start all services with one command (database + backend + frontend)**

Docker deployment assets live under `docker/`:
- Compose file: `docker/docker-compose.yml`
- Nginx reverse proxy config: `docker/nginx/frontend.conf`
- Single env file (shared by frontend build + backend runtime): `docker/.env`

1. Configure environment variables: Copy `docker/.env.example` to `docker/.env` and modify as needed (at minimum, change `AUTH_TOKEN_SECRET` and admin credentials)
2. Build and start services:
   ```bash
   docker compose -f docker/docker-compose.yml up -d --build
   ```
3. Access the frontend console: `http://localhost` (or `http://localhost:<HOOKCODE_FRONTEND_PORT>`)
   - Default admin credentials are in `docker/.env` as `AUTH_ADMIN_USERNAME/AUTH_ADMIN_PASSWORD` (example: `admin/admin`, must be changed in production)
   - After login, default routes:
     - Regular user: `#/account`
     - Admin: `#/admin/users`
     - Tasks list: `#/tasks`

**Custom Configuration:**
- **Ports**: Update `HOOKCODE_FRONTEND_PORT/HOOKCODE_BACKEND_PORT/HOOKCODE_DB_PORT` in `docker/.env`
- **Database Credentials**: Update `DB_USER/DB_PASSWORD/DB_NAME` in `docker/.env`
- **Cloudflare (single public port)**:
  - Keep `VITE_API_BASE_URL=/api` in `docker/.env`
  - Access APIs via `https://<your-domain>/api/...` (do NOT use `:8000`)
- **CI/CD**: Use secrets or variables in GitHub Actions or GitLab CI to manage sensitive information

**Technical Notes:**
- Both backend and frontend have independent Dockerfiles
- Docker Compose injects `docker/.env` via `env_file` (not committed to version control)

## Local Development

For source code development or debugging, use the following methods:

1. Install dependencies (recommended to enable corepack for pnpm)
   ```bash
   corepack enable
   pnpm install
   ```
2. Start everything (database + backend + frontend)
   ```bash
   pnpm dev
   ```
   - Console login is enabled: Default credentials are in `backend/.env.example` as `AUTH_ADMIN_USERNAME/AUTH_ADMIN_PASSWORD` (example: `admin/admin`, must change and set `AUTH_TOKEN_SECRET` for production)
   - Optional email self-registration: Set `AUTH_REGISTER_ENABLED=true` in backend (enabled in example), configure email service (e.g., `EMAIL_PROVIDER=smtp` + `SMTP_*`) and `HOOKCODE_CONSOLE_BASE_URL`. After registration, users receive a verification email and can log in after verification
   - After login, default routes:
     - Regular user: `#/account`
     - Admin: `#/admin/users`
     - Tasks list: `#/tasks`
   
3. **Module-specific Development:**
   - Start database only:
     ```bash
     pnpm dev:db
     ```
   - Backend only (default port 4000):
     ```bash
     pnpm dev:backend
     ```
   - Frontend only (default port 5173):
     ```bash
     pnpm dev:frontend
     ```

4. **Use Remote Database**: Copy `backend/.env.example` to `backend/.env`, keep local frontend/backend ports unchanged, and point the database to your remote Postgres (set `DB_HOST`, `DB_PORT`, etc., or set `DATABASE_URL` directly)

## Environment Variables

- **Backend**: `backend/.env.example`. Copy to `backend/.env` for local development or deployment (do not commit real secrets). For remote DB in development, override `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` (or set `DATABASE_URL` directly)
- **Frontend**: `frontend/.env.example` (Vite `VITE_*` variables are build-time injected; set `VITE_API_BASE_URL` to backend API base, e.g., `http://localhost:4000/api`)
- **Repository Configuration**: Robot/tokens are managed via console (database); env token fallbacks are not supported. Configure tokens per Robot/account/repository in the console

## License

MIT (see `LICENSE`).
