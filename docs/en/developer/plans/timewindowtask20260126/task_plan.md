# Task Plan: time windowed task execution
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. timewindowtask20260126 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** timewindowtask20260126
- **Created:** 2026-01-26

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Implement hour-level time-window execution for tasks with precedence (chat > trigger > robot), queueing reasons + direct-run option when outside the window, and the trigger-1 single-queue behavior, with backend/frontend updates, tests, and docs.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
<!-- Update current phase after completing planning and entering implementation. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
<!-- Reopen the plan to cover the chat composer time-window icon redesign. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
Phase 3

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
<!-- Mark planning checklist as complete after documenting approach and affected modules. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- [x] Define technical approach
- [x] Identify affected backend/frontend modules
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
<!-- Resume implementation for the chat composer time-window icon change. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- [x] Execute the plan step by step
- [x] Update backend scheduling logic and APIs
- [x] Update frontend configuration and queue UI
- [x] Add/adjust tests
- **Status:** in_progress

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
<!-- Reopen testing phase for the new chat UI tweak. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- [ ] Verify all requirements met
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** pending

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
<!-- Pause delivery until the new UI change is finished. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Where should time-window configuration live for robot/trigger/chat and how is precedence resolved in the current data model? (Plan: robot columns + automation rule JSON + chat request; resolve chat > trigger > robot at task creation.)
2. How are task queue reasons and "direct execute" actions represented in backend and surfaced in the UI today? (Plan: extend TaskQueueDiagnosis + new execute-now endpoint + UI button.)
3. What is the expected timezone (server, project, chat) for hour-level windows? (Plan: use server-local time and label it in UI.)

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Store robot-level time window as two nullable hour columns on repo_robots. | Structured storage for robot config; avoids JSON ambiguity and is easy to query. |
| Store trigger-level time window on automation rule JSON (`timeWindow`). | Matches trigger/rule scope without extra tables. |
| Resolve schedule at task creation and persist in task payload (`__schedule`). | Keeps queue gating and UI hints deterministic without extra joins. |
| Add queue reason `outside_time_window` + execute-now override endpoint. | Satisfies required reason messaging and manual bypass control. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
<!-- Capture the follow-up UI requirement for the chat composer time-window icon. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 -->
- Additional requirement: redesign task-group composer time window to a leftmost icon + popover picker, only showing selected window inline when set.
