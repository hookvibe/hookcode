---
title: Workers
---
{/* Update worker API docs to match the simplified worker metadata and disconnected Docker defaults. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312 */}

Worker APIs manage the worker registry and the backend-to-worker control channel.

<Callout type="info" title="Access model">
  The public worker management endpoints are admin-only. The internal `/api/workers/internal/*` endpoints are reserved for authenticated worker runtimes.
</Callout>

## Endpoint Map

- `GET /api/workers` — List local and remote workers.
- `POST /api/workers` — Create a remote worker and return one-time bootstrap credentials.
- `PATCH /api/workers/:id` — Update worker metadata such as `name` or `enabled`.
- `POST /api/workers/:id/rotate-token` — Rotate the worker bootstrap token and return the new token once.
- `POST /api/workers/:id/prepare-runtime` — Ask a connected worker to install provider runtimes.
- `DELETE /api/workers/:id` — Delete a remote worker.
- `GET /api/workers/connect` — WebSocket upgrade path used by workers to connect to the backend.

## Public API notes

- `POST /api/workers` returns bootstrap data including `workerId`, `token`, `backendUrl`, and `wsUrl`.
- Tokens are stored hashed on the backend; plain tokens are not retrievable after creation/rotation.
- Source-mode local workers are started automatically only when `HOOKCODE_SYSTEM_WORKER_MODE=local`; Docker/CI defaults keep worker auto-start disabled.
- Worker status includes online/offline state, runtime preparation state, heartbeat timestamps, and capability summaries.

## Internal worker channel

Workers use authenticated internal endpoints under `/api/workers/internal/*` to:

- fetch task execution context
- publish task logs
- patch intermediate results
- finalize task success/failure
- read task control state
- resolve sticky task-group metadata (thread ids, history, skills)
- bootstrap/verify PATs for worker-side provider flows

These internal endpoints are not intended for direct frontend or user use.
