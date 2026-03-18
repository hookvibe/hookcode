---
title: Workers
---
{/* Document admin worker APIs and the worker-runtime control channel. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}

Worker APIs manage the external executor registry and the backend-to-worker bootstrap flow.

<Callout type="info" title="Access model">
  The public worker management endpoints are admin-only. The internal `/api/workers/internal/*` endpoints are reserved for authenticated worker runtimes.
</Callout>

## Endpoint Map

- `GET /api/workers` — List local and remote workers.
- `POST /api/workers` — Create a remote worker and return a one-time bind code.
- `POST /api/workers/register` — Exchange a one-time bind code for runtime worker credentials.
- `PATCH /api/workers/:id` — Update worker metadata such as `name` or `enabled`.
- `POST /api/workers/:id/reset-bind-code` — Generate a new one-time bind code for a worker.
- `POST /api/workers/:id/prepare-runtime` — Ask a connected worker to install provider runtimes.
- `DELETE /api/workers/:id` — Delete a non-system-managed worker.
- `GET /api/workers/connect` — WebSocket upgrade path used by workers to connect to the backend.

## Public API notes

- `POST /api/workers` returns bind-code data including `bindCode` and `bindCodeExpiresAt`.
- Bind codes are one-time registration strings. After a worker exchanges one through `POST /api/workers/register`, the backend issues long-lived `workerId` + `workerToken` runtime credentials.
- Runtime tokens are stored hashed on the backend; plain runtime tokens are not retrievable after registration.
- The system-managed local worker cannot be deleted and is created/started automatically with the backend.
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
