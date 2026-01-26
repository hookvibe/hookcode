# Task Plan: Handle frontend network fluctuation toast
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. netflapui20260126 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** netflapui20260126
- **Created:** 2026-01-26

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
<!-- Define the goal for stabilizing network error UX without forced reloads. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
Ensure the task group page handles network flaps by showing a single, throttled warning and preserving page state without forced reloads.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
<!-- Advance the plan to delivery after implementation and testing. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
Phase 5

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
<!-- Mark discovery tasks complete after locating the chat view and polling logic. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
<!-- Close planning after selecting the throttling + snapshot preservation approach. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
<!-- Mark implementation complete after updating polling handling and tests. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
<!-- Close testing after running the focused Vitest suite. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
<!-- Close delivery after updating changelog and preparing handoff. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
<!-- Capture key questions guiding the network resilience change. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
1. Where does the frontend currently trigger page reloads or global error toasts on network failures for the task group page?
2. What is the desired UX cadence (debounce/throttle, auto-dismiss, manual retry) for intermittent connection failures?
3. Are there existing shared network interceptors or notification utilities we should extend instead of duplicating logic?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
<!-- Record the chosen approach for throttling network error UX. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
| Preserve existing task group snapshot on network failures and throttle a single warning toast during polling. | Avoids flicker/refresh on transient disconnects while still informing users. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
<!-- Track test failures encountered while validating the new behavior. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
| Vitest run timed out when using fake timers in the new polling test. | 1 | Replaced fake timers with a targeted `setInterval` spy and manual callback. |
| RangeError: maximum call stack size exceeded due to recursive timer spy. | 2 | Captured original timer functions before spying to avoid recursion. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
