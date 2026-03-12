---
title: Workers
---
{/* Document the standalone worker deployment and selection model for admins and operators. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}

HookCode now executes tasks through a standalone worker runtime.

There are two worker shapes in v1:

- **Local worker**: started automatically by source-mode backends when worker auto-start is enabled.
- **Remote worker**: deployed on any reachable machine, then connected back to the backend over WebSocket.

## Local worker

Source-mode backends start one built-in local worker automatically when `HOOKCODE_SYSTEM_WORKER_MODE=local` (the default outside Docker).

Use the local worker when you want:

- the simplest setup
- preview support
- a default execution target for new tasks

Notes:

- It shares the same standalone worker runtime as remote workers.
- In v1, preview/proxy features remain **local-worker only**.

## Remote workers

Remote workers are useful when you want HookCode to run commands on another machine.

Typical examples:

- a dedicated build box
- a GPU or high-memory machine
- an isolated sandbox host
- a machine inside a private network that can reach your repos/tools

### Create a remote worker

Go to **Settings → Workers** as an admin and create a worker.

The UI returns bootstrap information once:

- `workerId`
- `token`
- `backendUrl`
- `wsUrl`

Save the token immediately. The plain token is only shown at creation/rotation time.

### Start a remote worker

Today the worker is shipped inside the HookCode monorepo/workspace.

{/* Document Docker/production worker startup without the removed bundled-worker bootstrap path. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312 */}
For Docker/production deployments keep the backend on `HOOKCODE_SYSTEM_WORKER_MODE=disabled` so the app opens with no connected worker by default. Then create a remote worker in **Settings → Workers** and start it from source or from the dedicated `docker/docker-compose.remote-worker.yml` host flow below.
If you start Docker Compose manually for the main app stack, the recommended command is `docker compose -f docker/docker-compose.yml up -d --build db backend frontend`.

#### Option A: Run the worker directly from the repo

```bash
HOOKCODE_BACKEND_URL="https://your-hookcode.example.com/api" \
HOOKCODE_WORKER_ID="worker_xxx" \
HOOKCODE_WORKER_TOKEN="token_xxx" \
HOOKCODE_WORKER_NAME="Build Host A" \
HOOKCODE_WORKER_KIND="remote" \
HOOKCODE_WORKER_MAX_CONCURRENCY="1" \
pnpm --filter hookcode-worker start
```

#### Option B: Run a dedicated Docker worker on another machine

{/* Add an explicit remote-worker Docker path so operators can separate the backend host from the worker host without hand-writing Compose files. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
1. Copy `docker/.env.remote-worker.example` to `docker/.env.remote-worker`.
2. Fill `HOOKCODE_BACKEND_URL`, `HOOKCODE_WORKER_ID`, and `HOOKCODE_WORKER_TOKEN`.
3. Start the worker host:

```bash
docker compose --env-file docker/.env.remote-worker -f docker/docker-compose.remote-worker.yml up -d --build
```

4. Inspect logs when needed:

```bash
docker compose --env-file docker/.env.remote-worker -f docker/docker-compose.remote-worker.yml logs -f worker
```

{/* Link the new split-host deployment runbook from the worker guide so operators can jump from bootstrap concepts to the full production sequence. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
For the full production sequence across a backend host and a separate worker host, see [Split-Host Deployment](./split-host-deployment).

Useful environment variables:

- `HOOKCODE_BACKEND_URL`: backend API base URL
- `HOOKCODE_WORKER_ID`: worker id from the admin panel
- `HOOKCODE_WORKER_TOKEN`: worker bootstrap token
- `HOOKCODE_WORKER_NAME`: display name shown in the UI
- `HOOKCODE_WORKER_KIND`: `local` or `remote`
- `HOOKCODE_WORKER_MAX_CONCURRENCY`: max concurrent tasks
- `HOOKCODE_WORK_DIR`: shared root for `task-groups`, worker `runtime`, and worker `workspaces` (defaults to `~/.hookcode`)
- `HOOKCODE_WORKER_PREVIEW`: keep `false` for remote workers in v1

## Runtime installation

Remote workers do **not** ship with Codex / Claude / Gemini binaries preinstalled.

Behavior in v1:

- the worker package stays small by default
- provider runtimes install on first use or through **Prepare Runtime** in the Workers panel
- installed runtimes are cached under `HOOKCODE_WORK_DIR/runtime`
- sticky worker task directories live under `HOOKCODE_WORK_DIR/workspaces`, while backend task-group state lives under `HOOKCODE_WORK_DIR/task-groups`

## Worker selection

Task routing follows this model:

- source-mode backends can auto-start one local worker when `HOOKCODE_SYSTEM_WORKER_MODE=local`
- Docker/production deployments default to no connected worker until an operator starts one
- new chat/webhook tasks auto-pick the first online local worker, then the first online remote worker, when no explicit worker is pinned
- admins can override worker selection when creating chat tasks
- repo robots can define a **default worker** for future tasks
- tasks and task groups keep the selected worker id for traceability
- if no worker is online, creating a new task fails until a worker connects

## Health and failure behavior

Workers keep a persistent WebSocket connection to the backend.

The backend watches:

- connection state
- heartbeat freshness
- runtime preparation status

If a worker goes offline:

- tasks assigned to that worker stop receiving new work
- task groups bound to that worker stop accepting new execution until the worker is back
- the UI shows the worker status on task/task-group surfaces

## Current limitations

- Remote preview is not supported in v1.
- Worker creation, token rotation, enable/disable, and deletion are admin-only.
- Chat worker override currently depends on admin access because worker listing is admin-only.
