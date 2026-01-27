# Task Plan: Migrate frontend content to frontend-gemini
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. frontendgemini-migration-20260127 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** frontendgemini-migration-20260127
- **Created:** 2026-01-27

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Fully migrate the UI and content from `frontend` into `frontend-gemini` so screens, flows, and copy match, while keeping `frontend-gemini` free of the original UI component framework.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
<!-- Update the current phase marker for delivery completion. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
Phase 5 (Complete)

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [ ] Understand user intent
- [ ] Identify constraints and requirements
- [ ] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [ ] Define technical approach and migration checklist
- [ ] Map routes/pages/components from `frontend` to `frontend-gemini`
- [ ] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
<!-- Mark implementation and verification phases as complete after UI parity fixes. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
- [x] Implement missing pages, sections, and copy in `frontend-gemini`
- [x] Rebuild UI structure without using the original UI components
- [x] Keep styling/layout consistent with `frontend`
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
<!-- Record delivery phase completion after updating logs and changelog. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. What are the authoritative pages/routes and their exact content in `frontend` that must be matched?
2. What design tokens (colors, spacing, typography) in `frontend` must be mirrored in `frontend-gemini` without the UI framework?
3. Which interactive behaviors (modals, tables, forms) must match and how are they wired today?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Rebuild `frontend-gemini` UI with custom components (no AntD) while reusing backend APIs + logic from `frontend`. | Meets the "no frontend UI framework" constraint while keeping content/behavior parity. |
| Reuse `frontend` design tokens by porting `styles.css` into `frontend-gemini` and layering custom base styles. | Minimizes visual drift and accelerates parity with the existing UI design while allowing a fresh look. |
| Replace all AntD usage with custom components (no stubs/aliases) and update imports accordingly. | Satisfies the strict “no AntD components” requirement and ensures a new visual style. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
<!-- Log failed findings append attempt for tracking. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| Failed to append findings via malformed printf heredoc. | 1 | Will append via a safe heredoc command. |
<!-- Log vitest run failure for dependency + token mismatch tracking. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| Vitest run failed (missing @testing-library/react; dark token assertion mismatch). | 1 | Install missing test deps or adjust test expectations, then rerun. |
<!-- Log failed node script attempt to diff icon exports. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| Node script failed due to unquoted "@/ui/icons" token. | 1 | Rerun with corrected string quoting. |
<!-- Log repeated node script quoting failure for UI export audit. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| Node script failed again due to unquoted "@/ui" token. | 2 | Use quoted string literal before rerun. |
<!-- Log wrong-path lookup for task utils. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| sed failed because frontend-gemini/src/utils/task.ts path was incorrect. | 1 | Locate the correct utils/task file and retry. |
<!-- Log task list test failure caused by duplicate fetch calls. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| TasksPage tests failed (mocked list overwritten by duplicate fetch). | 1 | Added effect guards to avoid duplicate fetches per filter key. |
<!-- Log task detail panel switcher issue. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| TaskDetailPage tests failed (Steps not clickable, payload/prompt panels unreachable). | 1 | Updated Steps to support onChange and clickable items. |
<!-- Log dependency diagnostics UI mismatch. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| Dependency diagnostics tests failed (Radio/Select/Switch/Card props not forwarded). | 1 | Forwarded aria/data props and options support in custom UI components. |
<!-- Log delete button accessibility mismatch. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 -->
| Task delete button accessible name mismatch in tests. | 1 | Added delete icon aria-label to match legacy naming. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
