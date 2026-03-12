# Task Plan: Bind external worker by existing credentials

## Session Metadata
- **Session Hash:** external-worker-bind-existing-20260312
- **Created:** 2026-03-12

## Goal
Change external system-worker bootstrap so backend binds to an already-created remote worker by configured id/token instead of auto-creating or overwriting a worker row.

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm current GitHub Actions and Docker defaults for external worker mode.
- [x] Trace backend bootstrap flow for `HOOKCODE_SYSTEM_WORKER_MODE=external`.
- [x] Inspect worker selection logic and current tests/docs.
- **Status:** complete

### Phase 2: Planning & Backend Design
- [x] Define how configured credentials should resolve an existing worker.
- [x] Decide which worker fields may still be updated during backend bootstrap.
- [x] Identify failure modes for missing worker / wrong token / wrong worker kind.
- **Status:** complete

### Phase 3: Implementation
- [x] Replace external worker auto-registration with credential-based binding.
- [x] Preserve default-worker routing by marking the matched worker as system managed.
- [x] Keep startup failure handling auditable through system logs.
- **Status:** complete

### Phase 4: Verification
- [x] Add or update unit tests for config parsing and bootstrap behavior.
- [x] Run backend-targeted tests.
- [x] Run the full repo test suite per workflow requirement.
- [x] Run backend build.
- **Status:** complete

### Phase 5: Docs & Delivery
- [x] Update user-facing docs for external worker configuration semantics.
- [x] Update progress log and changelog entry.
- [x] Run completion check.
- **Status:** complete

## Final Technical Approach
- Keep `external` mode and env names intact so deployments do not need a config rename.
- Interpret `HOOKCODE_SYSTEM_WORKER_ID` + `HOOKCODE_SYSTEM_WORKER_TOKEN` as credentials for an existing remote worker row.
- Reject missing rows, token mismatches, disabled workers, or non-remote workers instead of creating a new row.
- Promote the matched worker into the backend-owned default worker set via `systemManaged=true` so task routing still finds it.
- Demote other remote `systemManaged` rows during binding so one backend keeps one configured external default.
- Refresh only routing safety metadata during bootstrap (`systemManaged`, `backendBaseUrl`, offline reset), while preserving worker identity fields created by admins.

## Key Decisions
- Preserve the existing worker name and max concurrency from the DB instead of overwriting them from backend env.
- Keep backend startup non-fatal when external binding fails, but log `WORKER_SYSTEM_BOOTSTRAP_FAILED` so operators can diagnose configuration errors.
- Require operators to create the remote worker entry first for Docker/split-host flows, then point backend `external` mode at that existing id/token pair.

## Risks / Follow-up Notes
- Bundled Docker worker deployments now require a pre-created worker entry before the worker can authenticate successfully.
- Split-host docs were updated to use a first-start `disabled` bootstrap, then switch to `external` after the worker entry exists.
- Full repo test suite passed after the change; backend build also passed.
