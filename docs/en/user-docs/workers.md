---
title: Workers
---
{/* Document the standalone worker deployment and selection model for admins and operators. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}

HookCode now executes tasks through a standalone worker runtime.

There are two worker shapes in v1:

- **Local worker**: started automatically by each backend instance and managed by the backend.
- **Remote worker**: deployed on any reachable machine, then connected back to the backend over WebSocket.

## Local worker

Source-mode backends start one built-in local worker automatically when `HOOKCODE_SYSTEM_WORKER_MODE=local` (the default outside Docker).

Use the local worker when you want:

- the simplest setup
- preview support
- a default execution target for new tasks

Notes:

- The local worker is registered as a **system-managed** worker.
- It shares the same standalone worker runtime as remote workers.
- In source mode, backend installs and starts the published `@hookvibe/hookcode-worker` package as a normal npm dependency.
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

The UI returns a one-time bind code plus an expiry time.

Save the bind code immediately. Each bind code can only be consumed once.

### Start a remote worker

The worker is now shipped as an external npm package and GHCR image.

#### Option A: Run the published npm package directly

```bash
HOOKCODE_WORK_DIR="$HOME/.hookcode/workers/worker-a" \
HOOKCODE_WORKER_BIND_CODE="hcw1...." \
hookcode-worker configure

HOOKCODE_WORK_DIR="$HOME/.hookcode/workers/worker-a" \
HOOKCODE_WORKER_NAME="Build Host A" \
HOOKCODE_WORKER_KIND="remote" \
HOOKCODE_WORKER_MAX_CONCURRENCY="1" \
npx @hookvibe/hookcode-worker@<required-version>
```

Or pin it globally first:

```bash
npm install -g @hookvibe/hookcode-worker
```

Use the exact version shown in **Settings → Workers** when backend reports a required worker version.

```bash
HOOKCODE_WORK_DIR="$HOME/.hookcode/workers/worker-a" \
HOOKCODE_WORKER_BIND_CODE="hcw1...." \
hookcode-worker configure

HOOKCODE_WORK_DIR="$HOME/.hookcode/workers/worker-a" \
HOOKCODE_WORKER_NAME="Build Host A" \
HOOKCODE_WORKER_KIND="remote" \
HOOKCODE_WORKER_MAX_CONCURRENCY="1" \
hookcode-worker
```

Useful environment variables:

- `HOOKCODE_WORKER_BIND_CODE`: one-time bind code copied from the admin panel
- `HOOKCODE_WORKER_NAME`: display name shown in the UI
- `HOOKCODE_WORKER_KIND`: `local` or `remote`
- `HOOKCODE_WORKER_MAX_CONCURRENCY`: max concurrent tasks
- `HOOKCODE_WORK_DIR`: shared root for `task-groups`, worker `runtime`, and worker `workspaces` (defaults to `~/.hookcode`)
- `HOOKCODE_WORKER_PREVIEW`: keep `false` for remote workers in v1
- `HOOKCODE_WORKER_FORCE_RECONFIGURE`: force a fresh bind-code exchange even if stored credentials already exist

## Runtime installation

Remote workers do **not** ship with Codex / Claude / Gemini binaries preinstalled.

Behavior in v1:

- the worker package stays small by default
- provider runtimes install on first use or through **Prepare Runtime** in the Workers panel
- installed runtimes are cached under `HOOKCODE_WORK_DIR/runtime`
- sticky worker task directories live under `HOOKCODE_WORK_DIR/workspaces`, while backend task-group state lives under `HOOKCODE_WORK_DIR/task-groups`

## Worker selection

Task routing follows this model:

- each backend has one default **system worker**
- source-mode backends default to the local supervised worker, while Docker/production deployments can default to a configured external worker
- new chat/webhook tasks execute on the current backend's selected system worker by default
- admins can override worker selection when creating chat tasks
- repo robots can define a **default worker** for future tasks
- tasks and task groups keep the selected worker id for traceability

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
- Worker creation, bind-code reset, enable/disable, and deletion are admin-only.
- Chat worker override currently depends on admin access because worker listing is admin-only.
