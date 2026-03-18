---
title: Quickstart
---



HookCode connects to GitHub/GitLab via Webhooks, creates tasks, and runs your configured coding assistant (Codex / Claude Code / Gemini CLI) through Robots.

## Prerequisites

- A server that can be reached by your Git provider’s webhook (public URL or tunnel).
- A database (Postgres). Docker Compose is the recommended setup.

## Deploy with Docker Compose (recommended)

Docker deployment assets live under `docker/`.

1. Copy and edit env:
   - Copy `docker/.env.example` → `docker/.env`
   - At minimum, change:
     - `AUTH_TOKEN_SECRET`
     - `AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD`
     - `HOOKCODE_WORK_DIR` if you want a different container work root (keep it absolute, for example `/var/lib/hookcode`)
     - `HOOKCODE_SYSTEM_WORKER_BIND_CODE` if you do not want to keep the example Docker worker bind code
2. Start services:
   ```bash
   docker compose -f docker/docker-compose.yml up -d --build
   ```
3. Open the console:
   - `http://localhost` (or `http://localhost:<HOOKCODE_FRONTEND_PORT>`)
4. Log in with the admin credentials you set in `docker/.env`.

{/* Document Docker's explicit work-root mount semantics so operators know `HOOKCODE_WORK_DIR` is persisted via named volumes and must stay absolute. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
Docker Compose persists backend and standalone-worker runtime state through separate named volumes mounted at `HOOKCODE_WORK_DIR`. In Docker deployments, keep `HOOKCODE_WORK_DIR` as an absolute container path because Docker volume targets do not expand `~`. The Docker quickstart defaults to `HOOKCODE_SYSTEM_WORKER_MODE=external`, so backend adopts one default external worker and the published worker image uses the same bind code on first boot, then restarts from persisted credentials.

## Local development (source mode)

1. Install dependencies:
   ```bash
   corepack enable
   pnpm install
   ```
2. Start database + backend + frontend:
   ```bash
   pnpm dev
   ```

> For detailed configuration, see [Environment variables & config](./environment).

## Connect a repository

1. In the console, open **Repos** and create a repository by pasting a GitHub/GitLab repository URL.
2. After creation, open the repository detail page and follow the onboarding instructions to configure:
   - Webhook URL
   - Webhook secret
3. In your Git provider (GitHub/GitLab), add a webhook that points to HookCode.

Webhook path format (relative):

```
/api/webhook/<provider>/<repoId>
```

Examples:

- GitHub: `/api/webhook/github/<repoId>`
- GitLab: `/api/webhook/gitlab/<repoId>`

## Create a robot and test it

1. In the repository detail page, create a Robot.
2. Configure:
   - Repo provider credentials (to read/write/comment on the repo)
   - Model provider + credentials (Codex / Claude Code / Gemini CLI)
   - Prompt template (the robot’s default instruction)
3. Click **Test** to validate credentials and activate the robot.

## Add an automation trigger

1. In the repository detail page, open the Automation section.
2. Enable an event type (Issue / Commit / Merge Request).
3. Create a rule:
   - Give it a name (required).
   - Choose matching conditions (optional).
   - Select one or more robot actions.
4. Save (the UI auto-saves and the backend validates).

## Verify tasks

- Trigger a matching event (create an issue, push a commit, comment, etc.).
- Open **Tasks** to see the queued/processing results.
- Open a task detail page to inspect logs and outputs (if task logs are enabled).
