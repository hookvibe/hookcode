# Task Plan: Migrate RepoTaskVolumeTrend chart to ECharts
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. nn62s3ci1xhpr7ublh51 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** nn62s3ci1xhpr7ublh51
- **Created:** 2026-01-20

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Replace the SVG-based `RepoTaskVolumeTrend` chart with an ECharts line/area chart while preserving existing date range controls, UTC-day semantics, and loading/error UX.

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
- [x] Choose ECharts integration approach (direct `echarts` vs wrapper)
- [x] Define chart option mapping (x-axis days, y-axis count, tooltip/labels)
- [x] Identify existing CSS/styling hooks to reuse or replace
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Add ECharts dependency to `frontend/package.json`
- [x] Refactor `RepoTaskVolumeTrend` to render via ECharts
- [x] Fix min/max x-axis label clipping on edges (ensure full date text renders)
- [x] Implement resize/dispose cleanup and avoid memory leaks
- [x] Keep loading/error rendering behavior unchanged
- **Status:** complete
{/* Fix ECharts x-axis edge label clipping after the SVG→ECharts migration. nn62s3ci1xhpr7ublh51 */}

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Add/adjust Vitest coverage for the component (mock ECharts lifecycle)
- [x] Run `pnpm --filter hookcode-frontend test` and record results
- [x] Verify min/max x-axis labels render fully (no edge clipping)
- [x] Verify all requirements met
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Update `docs/en/change-log/0.0.0.md` with session hash + plan link
- [x] Ensure session docs are complete (plan/findings/progress)
- [x] Summarize changes for handoff
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Should we integrate ECharts via the direct `echarts` API or a React wrapper, given bundle size and lifecycle concerns?
2. How do we keep resize/dispose behavior stable (ResizeObserver + `chart.resize()` + cleanup) across route changes?
3. How should axis labels and tooltips format dates/counts while keeping the underlying series keyed by UTC day strings?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Use modular ECharts integration | Keep the bundle explicit and avoid adding an extra React wrapper dependency. |
| Bridge chart styling via CSS variables | Ensure the chart follows the app theme and configurable accent color. |
| Keep chart container mounted during initial fetch | Avoid ECharts binding to a DOM node that would be unmounted by a top-level Skeleton return. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| Vite import-analysis: failed to resolve `echarts/core` | 1 | Added `echarts` to `frontend/package.json` via pnpm workspace install. |
| Vitest/JSDOM: `HTMLCanvasElement.prototype.getContext` not implemented | 1 | Mocked ECharts modules in `frontend/src/tests/setup.ts` and added a focused unit test. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
