# Task Plan: Fix frontend dist useLayoutEffect runtime error
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. frontenddistuselayoutfix20260319 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** frontenddistuselayoutfix20260319
- **Created:** 2026-03-19

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Ensure the production `frontend/dist` build loads without the `useLayoutEffect` runtime crash by fixing the bundle chunking strategy and verifying the emitted assets.

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
- [x] Inspect the emitted production chunks that reproduce the runtime failure
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Define technical approach
- [x] Decide how to keep React, ReactDOM, and their runtime dependencies in a safe chunk boundary
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Execute the plan step by step
- [x] Update frontend build config and adjacent comments
- [x] Add or adjust automated coverage for the bundling rule
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Verify all requirements met
- [x] Run frontend tests and production build
- [x] Inspect the emitted chunk graph for React-related circular imports
- [x] Document test results in progress.md
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review all output files
- [x] Update changelog entry for the session
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Which emitted chunk import cycle makes `vendor-misc` read `useLayoutEffect` from an uninitialized React namespace?
2. What is the smallest `manualChunks` change that removes the cycle without regressing bundle organization?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Diagnose the built assets instead of changing app hooks first | The failure only happens in `frontend/dist`, so the emitted chunk graph is the most reliable source of truth. |
| Classify `scheduler` into `vendor-react` and cover the rule with a unit test | `react-dom` depends on `scheduler`, so keeping them together removes the `vendor-react` ↔ `vendor-misc` cycle while preserving the existing vendor split strategy. |
| Re-evaluate the whole vendor split after re-reading the rebuilt assets | The rebuilt output still contains `vendor-react` ↔ `vendor-antd` imports, so the React runtime is not isolated enough for safe production evaluation. |
| Collapse React/Ant Design/misc dependencies into one primary `vendor` chunk and keep only clearly isolated heavy chunks separate | The final `vendor-t_mVVbgc.js` is self-contained, which removes the remaining cross-vendor React cycles while still isolating charts/markdown/workspace where it is safe. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| `vendor-misc-CSyIL6Xj.js` crashes on `h.useLayoutEffect` in the production build | 1 | Inspect `vendor-misc` and `vendor-react` imports, confirm the `scheduler`-driven chunk cycle, and then move `scheduler` into `vendor-react`. |
| Rebuilt assets still contain a `vendor-react` ↔ `vendor-antd` circular import | 2 | Simplify the vendor chunk strategy so React/Ant Design/misc runtime code no longer lives in mutually dependent manual chunks. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
