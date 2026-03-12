---
title: Split-Host Deployment
---

{/* Add a dedicated step-by-step runbook for operators who deploy backend and remote workers on different machines. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}

This guide shows how to deploy HookCode with:

- one **backend host** running `db + backend + frontend`
- one or more **remote worker hosts** running only the standalone worker

Use this layout when you want to keep the internet-facing backend separate from execution machines.

## Architecture overview

- The backend host exposes the HookCode UI and `/api`
- The backend host stores task state in Postgres
- Each worker host opens an outbound WebSocket connection back to the backend
- Tasks are routed to the connected worker selected by backend routing rules
- In v1, preview stays **local-worker only**, so split-host remote workers are for command execution rather than preview serving

## Before you start

Prepare these values first:

- a public backend URL such as `https://hookcode.example.com/api`
- one worker id/token pair from **Settings → Workers**
- admin credentials for the HookCode console
- persistent Docker storage on both hosts

## Step 1: Prepare the backend host

Use the main Docker stack on the backend machine.

```bash
cp docker/.env.example docker/.env
```

Set at least these values in `docker/.env`:

- `AUTH_TOKEN_SECRET`
- `AUTH_ADMIN_USERNAME`
- `AUTH_ADMIN_PASSWORD`
- `HOOKCODE_WORK_DIR=/var/lib/hookcode`
- `HOOKCODE_SYSTEM_WORKER_MODE=disabled`

{/* Update the split-host runbook for credential-based binding so first-time deployments create the remote worker before backend claims it as default. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312 */}
The main Docker stack now starts without any worker service, so backend comes up disconnected until you provision and start a worker separately.

## Step 2: Start the backend host

```bash
docker compose -f docker/docker-compose.yml up -d --build db backend frontend
```

Then verify the backend host:

```bash
docker compose -f docker/docker-compose.yml ps
```

```bash
docker compose -f docker/docker-compose.yml logs -f backend frontend
```

Once the backend is up:

- open the HookCode console
- sign in with the admin account
- create a remote worker under **Settings → Workers** and save its id/token
- expect the worker status to remain offline until the remote worker host connects

## Step 3: Prepare the worker host

On the separate worker machine:

```bash
cp docker/.env.remote-worker.example docker/.env.remote-worker
```

Set at least these values in `docker/.env.remote-worker`:

- `HOOKCODE_BACKEND_URL=https://hookcode.example.com/api`
- `HOOKCODE_WORKER_ID=<same-worker-uuid-as-backend>`
- `HOOKCODE_WORKER_TOKEN=<same-worker-token-as-backend>`
- `HOOKCODE_WORKER_NAME=<display-name>`
- `HOOKCODE_WORKER_KIND=remote`
- `HOOKCODE_WORKER_MAX_CONCURRENCY=1`
- `HOOKCODE_WORK_DIR=/var/lib/hookcode`

Important rules:

- `HOOKCODE_BACKEND_URL` must be reachable from the worker host
- `HOOKCODE_WORKER_ID` and `HOOKCODE_WORKER_TOKEN` must match the worker entry you created in **Settings → Workers**
- keep `HOOKCODE_WORKER_PREVIEW=0` for remote workers in v1

## Step 4: Start the worker host

```bash
docker compose --env-file docker/.env.remote-worker -f docker/docker-compose.remote-worker.yml up -d --build
```

Check worker logs:

```bash
docker compose --env-file docker/.env.remote-worker -f docker/docker-compose.remote-worker.yml logs -f worker
```

A healthy startup should show the worker connecting back to backend and staying alive instead of exiting.

## Step 5: Verify the connection

From the backend console:

- open **Settings → Workers**
- confirm the worker status becomes **online**
- confirm the displayed worker name matches the worker host config

Then create a manual chat task or webhook task and verify:

- the new task shows the expected worker
- the task group is pinned to that worker
- logs stream normally in the UI

## Step 6: Add more worker hosts

To add another worker host:

1. Create or rotate a separate worker token in **Settings → Workers**
2. Give that host its own `HOOKCODE_WORKER_ID` and `HOOKCODE_WORKER_TOKEN`
3. Start another copy of `docker/docker-compose.remote-worker.yml` on the new machine

Do not reuse the same worker id for different machines at the same time unless you intentionally want them to represent one logical worker.

## Operational notes

- Backend runtime data lives under backend `HOOKCODE_WORK_DIR`
- Worker runtime installs and sticky workspaces live under worker `HOOKCODE_WORK_DIR`
- Provider runtimes are installed on first use and cached under `HOOKCODE_WORK_DIR/runtime`
- If a worker goes offline, tasks assigned to it stop receiving new execution and related task groups stop accepting new work

## Troubleshooting

### Worker stays offline

Check:

- `HOOKCODE_BACKEND_URL` is correct and reachable
- the backend public reverse proxy allows WebSocket upgrades
- `HOOKCODE_WORKER_ID` and `HOOKCODE_WORKER_TOKEN` exactly match the backend-side worker record
- backend logs do not show authentication failures for `/workers/connect`

### Worker connects and then exits

Check:

- the worker host can resolve the backend domain
- TLS certificates are valid when using `https://`
- the worker host has persistent write access to `HOOKCODE_WORK_DIR`
- the worker log does not show internal API `401` or task command resolution errors

### Tasks still go to the wrong worker

Check the worker routing order:

- explicit task worker override
- task-group pinned worker
- repo robot default worker
- first online local worker, then first online remote worker

## Related docs

- [Workers](./workers)
- [Quickstart](./quickstart)
- [Environment variables & config](./environment)
