# Task Plan: Multi-language dependency management implementation
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. depmanimpl20260124 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** depmanimpl20260124
- **Created:** 2026-01-24

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Implement multi-language dependency management (runtime detection, config parsing, install validation/execution, API exposure, DB persistence, UI display) including multi-subproject installs.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Complete

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Confirm existing agent/task execution flow
- [x] Map storage requirements (DB + config priority)
- [x] Plan multi-subproject install behavior
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Add runtime detection service + API
- [x] Add `.hookcode.yml` parsing + validation
- [x] Add install command validation rules
- [x] Add dependency installer with multi-subproject support
- [x] Integrate into agent/task execution
- [x] Persist config/result in DB
- [x] Update UI (optional per plan)
- [x] Add/update tests
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

### Phase 6: UI extensions & verification
{/* WHAT: Add additional UI surfaces requested after initial delivery (robot dependency config + task detail diagnostics) and run verification. */}
- [x] Add robot dependencyConfig editor (enabled/failureMode/allowCustomInstall)
- [x] Display dependencyResult in Task Detail
- [x] Run frontend tests and attempt Prisma migration application
- **Status:** complete

### Phase 7: Dependency UI enhancements & broader tests
{/* WHAT: Add richer dependency UI (filtering/collapsing) and run more comprehensive frontend/backend tests (excluding DB migrations). */}
- [x] Enhance dependencyResult UI with filtering, keyword search, sorting, grouping, and collapse controls
- [x] Run broader frontend + backend tests (skip DB migrations)
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Where in the execution flow should dependency installs run for both tasks and task-groups? (After repo checkout and git workflow setup, before prompt build and baseline git capture.)
2. How to represent multi-subproject install targets in `.hookcode.yml` without breaking backward compatibility? (Use repeated runtime entries with a new optional `workdir` field.)
3. What DB migrations are needed for `dependencyConfig` and `dependencyResult`? (Add `repo_robots.dependency_config_json` and `tasks.dependency_result` JSONB columns.)

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Add `workdir` to each runtime entry to support multi-subproject installs via repeated entries. | Keeps `.hookcode.yml` structure simple and backwards compatible. |
| Store dependency install results in a dedicated `tasks.dependency_result` column. | Avoids bloating `result_json` while keeping logs separate from analysis output. |
| Provide `RuntimeService` via a new `SystemModule` and inject into agent and controller. | Ensures a singleton runtime cache and clean API exposure. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| Jest TS2307: Cannot find module '@jest/globals' in new unit tests | 1 | Removed @jest/globals imports and reran tests successfully |
| Vitest unknown option `--runTestsByPath` | 1 | Re-ran tests with file arguments (no flag) |
| Prisma P3005: database schema not empty | 1 | Stopped; needs baseline/migration plan for shared DB |
| Vitest pointer-events error when clicking radio input | 1 | Clicked label text instead of hidden radio input |
| Backend tests TS2322/TS2345 for dependencyConfig + agent services | 1 | Cast dependencyConfig in controller and mocked runtime/hookcode services |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
