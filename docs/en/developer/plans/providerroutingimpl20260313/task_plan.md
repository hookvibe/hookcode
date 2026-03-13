# Task Plan: Implement provider routing and failover MVP
<!-- Drive the provider-routing MVP implementation with explicit scope and traceability. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313 -->

## Session Metadata
- **Session Hash:** providerroutingimpl20260313
- **Created:** 2026-03-13

## Goal
Implement the first roadmap plan as a Phase-A MVP: allow each robot to define a fallback provider, retry once on provider execution failure, and record routing/failover decisions in execution logs and UI-visible robot config.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Re-read the roadmap file for plan 01
- [x] Locate robot config storage, execution entrypoints, and frontend editor bindings
- [x] Finalize the MVP scope and non-goals in findings.md
- **Status:** completed

### Phase 2: Backend Routing MVP
- [x] Add a shared routing config shape for robot provider config
- [x] Implement provider routing and single-step failover service
- [x] Hook agent execution into the routing/failover service and log decisions
- **Status:** completed

### Phase 3: Frontend Robot Editor MVP
- [x] Extend API/public config types with routing config
- [x] Add fallback-provider controls to the repo robot editor
- [x] Show routing guidance so users understand the new behavior
- **Status:** completed

### Phase 4: Verification
- [x] Add backend unit tests for routing/failover behavior
- [x] Run targeted tests and backend/frontend builds
- [x] Record validation and any limits in progress.md
- **Status:** completed

### Phase 5: Delivery
- [x] Update docs/changelog/plan index if needed
- [x] Review changed files for traceability comments
- [x] Hand off the MVP scope and remaining roadmap phases to the user
- **Status:** completed

## Key Questions
1. What counts as the MVP for roadmap plan 01? → One primary provider, one optional fallback provider, one automatic failover attempt, and routing/failover log visibility.
2. Where should routing config live? → Inside the existing `modelProviderConfig` JSON so the MVP avoids a schema migration.
3. What is intentionally out of scope for this round? → Task-type routing, provider health APIs, multi-step fallback chains, and budget-aware routing.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Implement roadmap plan 01 as Phase-A MVP only | This keeps the feature shippable and consistent with the roadmap's staged rollout. |
| Store routing config inside `modelProviderConfig` | Reuses the existing robot config persistence path and minimizes invasive schema work. |
| Start with one fallback provider and one automatic retry | This captures the main reliability gain without overcomplicating the first iteration. |
| Keep credential resolution local-first inside each selected provider | The new routing layer should compose with the existing provider credential resolver rather than replace it. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` reported `docs.json missing navigation.languages[]` | 1 | Continued because the planning files were still created successfully. |

## Notes
- Every changed code area must include an English inline traceability comment ending with `docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313`.
- This session intentionally implements roadmap plan 01 MVP, not the full multi-phase roadmap.
