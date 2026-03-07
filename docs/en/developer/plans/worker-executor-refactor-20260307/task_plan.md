# Task Plan: External worker executor refactor

## Session Metadata
- **Session Hash:** worker-executor-refactor-20260307
- **Created:** 2026-03-07

## Goal
Refactor HookCode task execution so all task runs go through a standalone external worker package, while backend becomes the dispatcher/manager and frontend exposes worker administration plus worker selection controls.

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm current worker, task runner, chat, webhook, and preview flow
- [x] Identify UX, API, schema, and execution constraints
- [x] Record findings and architecture decisions
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define the standalone worker architecture and protocol boundaries
- [x] Define backend scheduler, worker registry, and local supervisor responsibilities
- [x] Define frontend admin/repo/task-group integration points
- **Status:** complete

### Phase 3: Implementation
- [x] Add worker registry schema, DTOs, services, and APIs
- [x] Refactor backend task dispatching and local worker supervision
- [x] Create the standalone `worker` workspace and runtime protocol client
- [x] Add frontend worker admin + worker selection UI
- [x] Update docs and changelog
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted backend tests for worker dispatch, worker API, and task-group blocking
- [x] Run frontend tests covering worker UI and selection flows
- [x] Run full project test suite after test updates
- [x] Run package builds for backend, frontend, and worker
- **Status:** complete

### Phase 5: Delivery
- [x] Review all changed files for traceability comments and i18n
- [x] Record final progress and test results
- [x] Deliver summary and follow-up risks to the user
- **Status:** complete

## Key Questions
1. How can backend offload execution without giving the external worker direct DB access?
2. How do task logs, cancellation, worker liveness, and task-group worker locking map onto the existing task lifecycle?
3. Which current features remain local-only in v1, especially preview/proxy capabilities?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use a standalone `worker` workspace as the only executor implementation. | Removes the inline/external split and makes local + remote workers share the same runtime and protocol. |
| Keep worker as a pure executor without business DB access. | Preserves backend as the system of record and keeps external deployment simpler and safer. |
| Use worker-initiated WebSocket connections for hello, heartbeat, task assignment, logs, and results. | Supports bidirectional control, liveness detection, and event-driven dispatch. |
| Keep task groups worker-bound for their lifetime. | Preserves shared workspace/git state semantics across chat/task-group execution. |
| Limit preview support to the local system-managed worker in v1. | Remote preview proxying is out of scope for the first cut and would break current local networking assumptions. |
| Default local worker concurrency to 2 and remote worker concurrency to 1. | Keeps local throughput close to current behavior while staying conservative for remote hosts. |

## Implementation Notes
- Add a new `worker` workspace to `pnpm-workspace.yaml` and root scripts.
- Replace backend standalone worker execution with a local worker supervisor + dispatcher protocol.
- Add admin-only worker management APIs and frontend settings UI.
- Extend repo robots, task groups, tasks, and chat creation flows with worker selection metadata.
- Keep all changed code areas annotated with English traceability comments referencing this plan.
- Keep the local system-managed worker on a backend-inline fallback path until the remote-safe execution envelope fully replaces commandless tasks.
- Use HOOKCODE_WORK_DIR=~/.hookcode as the single storage root for backend task-groups plus worker runtime/workspace directories.
- Keep `HOOKCODE_WORK_DIR` limited to runtime state such as task groups, worker caches, and auth secrets while schema migrations continue following the packaged backend code tree.
- Add configurable system-worker modes so source deployments can keep the local supervisor while Docker/production deployments bootstrap a default external worker from env-backed credentials.
- Add dedicated `docker/docker-compose.remote-worker.yml` and `docker/.env.remote-worker.example` assets so split-host backend/worker deployments stay reproducible.
- Add a dedicated user-facing split-host deployment guide for operators running backend and worker machines separately.
