<!-- Record the implementation plan for shared global robots, global credentials, and the next hardening batch. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa -->
# Task Plan: Global robots, global credentials, ongoing hardening, and test stabilization
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. 52d0x2aa8umrjgjklgwa */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** 52d0x2aa8umrjgjklgwa
- **Created:** 2026-04-13

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Continue the same shared global robots and global credentials session after commit `29340a0`, focusing next on the root `pnpm run test` failures caused by stale frontend `listAvailableRepoRobots` mocks and sandbox-incompatible backend preview tests.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 19

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify core planning constraints and cross-surface requirements
- [x] Document the initial findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Domain & API Design
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Define the persistent model for admin-managed global robots and any migration strategy
- [x] Lock the mixed-scope API contract for selectors, automation payloads, and runtime resolution
- [x] Document audit, authorization, and read-only consumption rules for repository contexts
- **Status:** complete

### Phase 3: Backend Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Add backend persistence and services for global robots
- [x] Update mixed-scope robot listing and runtime execution resolution
- [x] Close the backend compile gaps for global credential and mixed-scope robot wiring
- [x] Add logging, validation, and backend tests for admin-managed global robot and credential behavior
- **Status:** complete

### Phase 4: Frontend Integration & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Add frontend system API clients for global robot and global credential management
- [x] Update admin settings UI to manage global robots and global provider credentials
- [x] Update repository-facing selectors to merge repository and global robots with explicit source labels
- [x] Verify API, UI, and automated flows with targeted and full test coverage
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review backend, frontend, migrations, and docs consistency for the implemented feature
- [x] Summarize delivered behavior, tests, and any unresolved risks
- [x] Finalize the recorder session and changelog entry
- **Status:** complete

### Phase 6: Follow-up Scope Lock
{/* WHAT: Reopen the completed session for the first hardening batch. WHY: The user wants to continue from the committed baseline instead of starting a new feature session. */}
- [x] Confirm the baseline feature state that was committed in `c00eeb6`
- [x] Identify the concrete DTO, controller-test, DTO-test, and i18n files for the first hardening batch
- [x] Record the first-batch scope without overwriting the original delivery history
- **Status:** complete

### Phase 7: First Hardening Batch
{/* WHAT: Implement the requested follow-up cleanup. WHY: Keep the next scope narrow and traceable. */}
- [x] Add DTO validation for system global robot create and update endpoints
- [x] Add focused controller-level tests and DTO tests for the system global robot APIs
- [x] Extract the new global robot and global credential UI strings into i18n message files
- **Status:** complete

### Phase 8: Next Hardening Scope
{/* WHAT: Lock the next high-priority hardening scope. WHY: The first hardening batch is committed in `0249536`, so the next work should start from the new baseline. */}
- [x] Confirm the next baseline now includes feature commit `c00eeb6` plus first hardening batch commit `0249536`
- [x] Identify the next highest-priority fixes: disabled global robot execution guards and stronger backend error handling
- [x] Record the new follow-up risks and likely touch points before implementation starts
- **Status:** complete

### Phase 9: Disabled Robot Guard & Error Handling
{/* WHAT: Implement the next hardening fixes. WHY: The next likely bugs are direct-id disabled global robot execution and brittle controller error handling. */}
- [x] Prevent disabled global robots from resolving through mixed-scope direct-id runtime lookup
- [x] Replace brittle global robot controller error mapping with stronger backend error handling
- [x] Add focused regression coverage for the new guard and error-handling behavior
- **Status:** complete

### Phase 10: Hardening Verification & Commit Prep
{/* WHAT: Verify the next hardening fixes and prepare the next clean commit. WHY: The user wants validated changes before the next commit. */}
- [x] Run targeted and full validation for the next hardening batch
- [x] Summarize the next hardening changes and any remaining risks
- [x] Prepare the next hardening batch for a clean commit
- **Status:** complete

### Phase 11: Global Credentials Validation Scope
{/* WHAT: Lock the next hardening target after commit `4b2afe3`. WHY: The next remaining validation gap is in the system-level global credential admin flow rather than mixed-scope robot execution. */}
- [x] Confirm the next baseline now includes feature commit `c00eeb6`, first hardening batch commit `0249536`, and disabled-global-robot hardening commit `4b2afe3`
- [x] Identify the remaining system-level gap in global credential validation and controller error handling
- [x] Record the narrow service/controller scope and adjacent out-of-scope controllers before implementation starts
- **Status:** complete

### Phase 12: Global Credentials Validation Hardening
{/* WHAT: Harden the remaining system global-credentials validation path. WHY: The current `PATCH` flow still depends on brittle message matching instead of a stable validation contract. */}
- [x] Add stable service-level validation errors for missing global credential profile remarks
- [x] Replace controller-side message matching in the global credentials `PATCH` flow with stable error-code handling
- [x] Add focused service and controller regression coverage for the new validation behavior
- **Status:** complete

### Phase 13: Validation & Commit Prep
{/* WHAT: Finish verification for the current global-credentials hardening slice. WHY: The latest targeted validation passed, but the full backend suite still needs to run before commit prep is complete. */}
- [x] Run targeted validation for the current global-credentials hardening slice
- [x] Run the full backend suite after the current validation changes
- [x] Summarize remaining risks and prepare the batch for a clean commit
- **Status:** complete

### Phase 14: User & Repository Credential Validation Scope
{/* WHAT: Lock the next adjacent hardening batch after commit `04bf5de`. WHY: The remaining message-based credential validation mapping now lives in user and repository controller flows rather than the already-hardened global credential path. */}
- [x] Confirm the next baseline now includes commits `c00eeb6`, `0249536`, `4b2afe3`, and `04bf5de`
- [x] Identify the remaining user and repository credential validation paths that still rely on message matching
- [x] Decide whether the next batch should share a validation abstraction or stay scoped to user and repository service/controller pairs
- **Status:** complete

### Phase 15: User & Repository Credential Validation Hardening
{/* WHAT: Harden the remaining non-global credential validation flows. WHY: Users and repositories still have controller-side message matching fed by service errors, which is the next adjacent consistency gap. */}
- [x] Add stable service-level validation errors for the remaining user and repository credential remark validation paths
- [x] Replace controller-side message matching in `users.controller` and `repositories.controller` with stable error-code handling
- [x] Add focused regression coverage for the user and repository validation behavior
- **Status:** complete

### Phase 16: Validation & Commit Prep
{/* WHAT: Verify the next user/repository credential hardening batch and prepare it for commit. WHY: The current session should keep each hardening slice fully validated before another handoff. */}
- [x] Run targeted and full validation for the user and repository credential hardening batch
- [x] Summarize remaining risks after the user/repository validation changes
- [x] Prepare the next hardening batch for a clean commit
- **Status:** complete

### Phase 17: Frontend Test Failure Scope
{/* WHAT: Lock the next continuation scope after commit `29340a0`. WHY: The current blocker has shifted from backend hardening to a frontend Vitest regression around the `src/api` mock surface. */}
- [x] Confirm the next baseline now includes backend hardening commits through `29340a0`
- [x] Identify the exact mock/export gap causing `appShell` and `TaskDetailPage` frontend tests to fail
- [x] Record the smallest safe frontend test-fix touch points before implementation starts
- **Status:** complete

### Phase 18: Test Stabilization Fixes
{/* WHAT: Fix the stale test assumptions surfaced by the root rerun. WHY: The current failures span stale frontend available-robot mocks and backend preview tests that are not hermetic under the sandbox. */}
- [x] Add the missing `listAvailableRepoRobots` export to the affected frontend API mocks and helpers
- [x] Update affected frontend assertions to the current mixed-scope robot label behavior
- [x] Make preview backend tests hermetic with tmp-root filesystem redirection and mocked port or socket behavior instead of real OS dependencies
- **Status:** complete

### Phase 19: Validation & Commit Prep
{/* WHAT: Verify the test-stabilization fixes and prepare the batch for handoff. WHY: The current continuation should end with the root test flow green inside the sandboxed environment. */}
- [x] Run the affected frontend tests and preview backend tests after the stabilization fixes
- [x] Run the broader frontend and root test validation needed to confirm the batch
- [x] Summarize the test-stabilization fix and prepare the batch for a clean commit
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Which remaining root-test failures are caused by stale frontend mocks versus backend preview-test hermeticity gaps?
2. Which shared frontend helpers need `listAvailableRepoRobots` so all mixed-scope robot selectors stay aligned in tests?
3. Which preview tests can be stabilized through tmp-root and mocked port/socket seams without changing production behavior?
4. What validation is sufficient to confirm the root `pnpm run test` flow is green in the current sandbox?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Reuse the already-created session hash `52d0x2aa8umrjgjklgwa` for this interrupted initialization. | The user re-issued the same `INIT_SESSION` request for the same new task, so one session directory remains the single source of truth. |
| Treat this as a cross-cutting planning task spanning storage, execution, API, and UI surfaces. | The requested behavior affects how bots are defined centrally, consumed at runtime, and labeled in both APIs and selection interfaces. |
| Require explicit bot origin metadata in the eventual design rather than inferring origin from context alone. | Clear repository-level versus global-level labeling is an explicit user requirement and reduces ambiguity for API clients and UI users. |
| Continue implementation work in the existing session instead of opening a second session for the same feature. | The user explicitly asked to reuse the session hash, and a single authoritative plan keeps discovery, design, and implementation traceable together. |
| Treat the backend implementation as largely complete and backend build-green for this continuation. | The latest continuation context says remaining work is primarily frontend completion, validation, migrations if needed, and final recorder sync. |
| Keep repo editors on the default global credential profile path instead of adding full admin-profile enumeration in repository flows. | The current implementation can safely ship mixed-scope execution without introducing a new backend metadata surface for all global credential profiles. |
| Check in a manually authored Prisma migration for the new global tables in this environment. | `prisma migrate diff` required a shadow database URL here, so writing the SQL explicitly was the practical way to preserve schema traceability. |
| Require exact-match semantics when `credentialProfileId` is explicitly provided during stored credential resolution. | Falling back to a default or first profile after an explicit profile id stops matching can silently switch credentials, so the follow-up hardening should fail fast for explicit ids while preserving the current implicit default behavior. |
| Validate explicit global repo and model credential profile ids at save time for shared robots. | Rejecting stale explicit profile ids in `GlobalRobotService` prevents misconfigured global robots from silently drifting to different global credentials at runtime. |
| Reuse the same session after baseline commit `c00eeb6` instead of opening a new planning thread for the hardening batch. | The user explicitly framed the new work as a continuation of the same shared-global task, so one session should carry the original implementation, hardening, and cleanup history. |
| Implement the first hardening batch with dedicated system DTOs, new controller and DTO tests, and i18n extraction in the existing locale domain files. | The current worktree is already committed at `c00eeb6`, existing DTO patterns are module-local, and the frontend locale structure already has a domain-based organization to extend. |
| Treat commit `0249536` as the new baseline for the next hardening batch. | The user explicitly said the baseline feature commit `c00eeb6` and the first hardening batch commit `0249536` are complete, so new planning should start after those changes. |
| Prioritize disabled global robot execution guards and stronger backend error handling next. | The current audit narrowed the remaining high-priority issues to direct-id disabled global robot resolution and brittle controller error mapping. |
| Treat commit `4b2afe3` as the next baseline for the current hardening slice. | The user explicitly said the baseline feature commit `c00eeb6`, first hardening batch commit `0249536`, and disabled-global-robot hardening commit `4b2afe3` are complete before starting the next validation-focused batch. |
| Keep the current hardening slice narrowly scoped to `GlobalCredentialService` and `GlobalRobotsController`. | The remaining brittle validation mapping is isolated to the system global-credentials admin flow, while similar user and repository controllers are fed by different services and should not expand the batch unless necessary. |
| Treat commit `04bf5de` as the next baseline for the current hardening slice. | The user explicitly said commits `c00eeb6`, `0249536`, `4b2afe3`, and `04bf5de` are complete before checking the remaining user and repository credential validation paths. |
| Move the next batch to the user and repository credential validation flows without reopening the already-hardened global credential path. | The current adjacent gap is controller-side message matching in `users.controller` and `repositories.controller`, while the global credential `PATCH` flow was just stabilized in commit `04bf5de`. |
| Reuse one shared credential-validation helper instead of adding more one-off local error classes. | `user.service`, `repository.service`, and the already-hardened global credential flow now share the same missing-remark validation pattern, so one helper keeps code/details aligned across adjacent APIs. |
| Advance the current batch to validation after the shared credential-validation helper compiled and passed targeted coverage. | The service/controller refactor is now implemented across global, user, and repository flows, so the remaining work is full-suite validation and final risk review rather than more design churn. |
| Keep the shared `CredentialValidationError` helper as the common missing-remark contract across global, user, and repository credential update flows. | The targeted and full backend validation now pass with one shared helper plus `instanceof`-based controller mapping, so the abstraction is proven and should stay centralized. |
| Treat commit `29340a0` as the next baseline for the current frontend stabilization slice. | The user explicitly said backend hardening commits through `29340a0` are complete, so the next continuation should focus only on the frontend test regression introduced afterward. |
| Keep the first frontend repair batch narrowly scoped to stale `../api` mocks in `appShell` and `TaskDetailPage` tests. | The current Vitest failure points to a specific export mismatch around `listAvailableRepoRobots`, so the safest next step is to patch those mocks before widening the search surface. |
| Return one matching available-robot entry from `taskDetailPage.test.tsx` and update its expectation to `listAvailableRepoRobots`. | `TaskDetailPage` now uses `listAvailableRepoRobots` to recover provider labels, so one repo-scoped `bot1` / `codex` mock entry preserves the existing assertion path with the smallest test-only change. |
| Fix the remaining `TaskDetailPage` failure in the test assertion instead of reverting the current UI summary rendering. | The page now intentionally shows separate permission/scope/provider tags plus a formatted robot label, so the correct repair is a less brittle assertion on the current output rather than changing product behavior back to the old text. |
| Widen the current frontend repair batch to all stale `../api` mocks and helpers that still assume `listRepoRobots`-only behavior. | The root rerun now shows the same export-drift pattern in `RepoDetailPage` and task-group chat composer coverage, so patching only `appShell` and `TaskDetailPage` would leave the suite red. |
| Keep the preview-test fixes test-only through tmp-root filesystem redirection and mocked port/socket behavior. | The preview failures come from sandbox-incompatible OS access in tests, so the fastest safe repair path is hermetic test setup rather than production behavior changes. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| The first initialization turn was interrupted after creating the session directory but before the planning docs were populated. | 1 | Reused the same session hash and continued filling the planning files instead of creating a duplicate session. |
| The shared credential-validation refactor introduced one build-blocking TypeScript error in `repository.service` plus stale test assertions against the old global-only error shape. | 1 | Patched the out-of-scope repository-provider lookup, updated the affected assertions to the stable code/details contract, and moved the batch forward after targeted coverage plus backend build passed. |
| Root test reruns surfaced stale frontend mocks and backend preview tests that depended on real home-directory paths or localhost sockets. | 1 | Updated the stale frontend mock surfaces to `listAvailableRepoRobots`, aligned assertions with mixed-scope robot labels, and converted preview tests to tmp-root plus mocked port/socket behavior so root test execution passes in the sandbox. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
