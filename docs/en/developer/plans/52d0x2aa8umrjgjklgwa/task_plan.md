<!-- Record the implementation plan for shared global robots and global provider credentials. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa -->
# Task Plan: Global robots and global provider credentials
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. 52d0x2aa8umrjgjklgwa */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** 52d0x2aa8umrjgjklgwa
- **Created:** 2026-04-13

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Continue implementing shared global robots and global provider credentials so repositories can select repository or global robots with source labels, and global credentials can be used across repository execution flows.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 5

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

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Which frontend API clients and page surfaces still need mixed-scope robot and global credential wiring?
2. What targeted and full-suite tests are still required to validate frontend behavior and end-to-end mixed-scope execution?
3. Are any migrations or validation updates still missing before the session can be finalized?
4. What recorder, docs, and changelog updates remain once implementation and tests are complete?

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

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| The first initialization turn was interrupted after creating the session directory but before the planning docs were populated. | 1 | Reused the same session hash and continued filling the planning files instead of creating a duplicate session. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
