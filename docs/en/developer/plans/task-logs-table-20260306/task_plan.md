# Task Plan: Task log table + pagination
{/* Maintain session planning details for log table migration work. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306 */}
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. task-logs-table-20260306 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** task-logs-table-20260306
- **Created:** 2026-03-06

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Move task execution logs into a dedicated task_logs table with indexed access and update the backend/frontend to stream + page logs without loading large JSON payloads, including chained task-group timeline loading.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 5

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
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
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

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. How should logs be paged and streamed without loading large payloads? (Use task_logs table + tail/prev queries + SSE with seq.)
2. How should historical logs be migrated and result_json cleaned safely? (SQL backfill + remove logs/logsSeq keys.)
3. How should TaskGroup chat load tasks/logs to avoid mounting every task log viewer at once? (Use chained loading: current task logs first, then reveal previous task.)

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Store task logs in a new task_logs table keyed by task_id + seq | Avoid oversized JSON payloads and enable indexed pagination. |
| Keep logs in SSE init + log events with seq | Preserve real-time UX while supporting log pagination. |
| Migrate existing logs and strip result_json logs fields | Reduce payload bloat for historical tasks. |
| Switch TaskGroup chat to chained task/log loading | Prevent concurrent multi-task log loading and reduce initial render pressure on long task groups. |
| Add HTTP bootstrap fallback when log SSE init is missing | Prevent chain loading from stalling on paused/failed tasks when log stream initialization fails. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| init-session.sh reported missing docs.json navigation.languages[] | 1 | Proceeded with session files created; skip docs.json sync for now. |
| Prisma P1012 TaskLog relation missing opposite field | 1 | Added Task.logs relation in schema.prisma. |
| Jest compile errors (missing logs buffer + controller DI) | 1 | Restored in-memory log tail + updated tests/constructors. |
| Vitest failure: "Load earlier" button not found (i18n) | 1 | Matched button label with bilingual regex in test. |
| Vitest chain-loading test flaked in full suite | 1 | Retried top-scroll inside waitFor to avoid state propagation race after log-page completion. |
| Chain loading stalled when active task log stream errored before init | 1 | Added TaskLogViewer HTTP bootstrap fallback and regression test for stream-error continuation. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
