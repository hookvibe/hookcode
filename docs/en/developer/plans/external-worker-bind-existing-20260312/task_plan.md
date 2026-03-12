# Task Plan: Remove Docker/Actions worker bootstrap and system-managed worker semantics

## Session Metadata
- **Session Hash:** external-worker-bind-existing-20260312
- **Created:** 2026-03-12

## Goal
Remove GitHub Actions/Docker worker deployment/bootstrap behavior so deployments start with no connected worker by default, keep local worker support only for source-mode local runs, and delete the user-facing/system-routing concept of system-managed workers.

## Current Phase
Complete

## Phases
### Phase 1: Requirements & Discovery
- [x] Reconfirm the updated user requirement: no Docker/Actions worker bootstrap, no default connected worker, no system-managed concept.
- [x] Map worker bootstrap, routing, DTO, UI, and docs surfaces affected by `systemManaged` and `HOOKCODE_SYSTEM_WORKER_*`.
- [x] Verify task creation behavior when no worker is available.
- **Status:** complete

### Phase 2: Design
- [x] Decide how default worker routing should behave without system-managed flags.
- [x] Decide how backend local inline execution should be authorized after removing the concept.
- [x] Decide how CI/Docker defaults should leave deployments with zero connected workers.
- **Status:** complete

### Phase 3: Backend & Workflow Implementation
- [x] Remove GitHub Actions worker bootstrap/deployment env wiring.
- [x] Remove backend external worker bootstrap flow and system-managed routing rules.
- [x] Update worker CRUD/selection logic to operate without `systemManaged`.
- [x] Keep source-mode local worker support working in `local` mode only.
- **Status:** complete

### Phase 4: Frontend & API Contract
- [x] Remove the `systemManaged` field from API-facing DTOs/types.
- [x] Remove system-managed labels/locks from the workers settings UI.
- [x] Ensure worker selectors and task creation flows still behave correctly with zero connected workers.
- **Status:** complete

### Phase 5: Verification & Docs
- [x] Add/update unit tests for routing, inline execution, and workers panel behavior.
- [x] Run targeted tests, the requested full repo test command, backend build, and Docker Compose config validation.
- [x] Update user docs and changelog for the new deployment/worker model.
- **Status:** complete

## Final Design Direction
- Keep `HOOKCODE_SYSTEM_WORKER_MODE=local|disabled` support, but remove external bootstrap usage from GitHub Actions, Docker defaults, and the backend startup path.
- In fallback routing, only auto-pick online workers; do not pick offline workers just because they exist.
- Remove `systemManaged` from API responses, frontend state, UI labels/actions, and the Prisma schema.
- Allow inline backend execution for local workers by `kind === 'local'` instead of a special system-managed marker.
- Keep local worker auto-start only in source-mode/local mode; Docker/Actions deploy paths default to `disabled` so the UI opens with no connected worker.
- Remove the bundled worker service from the main `docker/docker-compose.yml`; dedicated Docker worker usage now goes through `docker/docker-compose.remote-worker.yml` only.

## Key Decisions
- Do not auto-create or auto-bind any worker during Docker/Actions deployment.
- Do not expose or depend on `systemManaged` in user-facing or backend routing behavior.
- When no online/default worker exists, task creation should fail fast with the existing `WORKER_NOT_CONFIGURED` behavior.
- Update the database schema too, so the retired concept disappears from data storage and generated Prisma types.

## Risks / Notes
- Existing tasks/robots can still pin explicit worker ids; those code paths remain intact.
- The full `pnpm test` command still fails in this sandbox because several pre-existing preview tests need filesystem/socket permissions outside the current environment.
- Targeted worker tests, all frontend tests, all worker tests, backend build, and Docker Compose config validation passed after this change.
