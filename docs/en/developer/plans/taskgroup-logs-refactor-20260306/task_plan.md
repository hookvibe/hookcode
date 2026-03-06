# Task Plan: Task group log loading refactor - performance and UX improvements
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. taskgroup-logs-refactor-20260306 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** taskgroup-logs-refactor-20260306
- **Created:** 2026-03-06

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Refactor task group log loading to fix performance bottlenecks (DB/frontend/network), improve error handling for failed tasks, and add comprehensive loading UX (skeletons, animations, progress indicators).

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 6 (Delivery)

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Backend Performance & Error Handling
{/* WHAT: Fix DB queries, add batch writes, improve error recovery */}
- [x] Add performance logging to TaskLogsService
- [x] Optimize database queries and indexes
- [x] Add batch log writes in agent
- [x] Improve SSE error handling and reconnection
- **Status:** complete

### Phase 3: Frontend Performance
{/* WHAT: Add virtual scrolling, optimize rendering, debounce scroll */}
- [x] Add virtual scrolling to TaskLogViewer
- [x] Optimize TaskGroupChatPage scroll handling
- [x] Lazy-load TaskLogViewer components
- **Status:** complete

### Phase 4: Loading UX & Animations
{/* WHAT: Add skeletons, progress indicators, smooth transitions */}
- [x] Add skeleton loaders during initial load
- [x] Add loading indicators for pagination
- [x] Add CSS fade-in animations
- [x] Add progress indicators in TaskGroupChatPage
- **Status:** complete

### Phase 5: Error UI & Manual Recovery
{/* WHAT: Show clear error states, allow manual skip to next task */}
- [x] Improve error state UI in TaskLogViewer
- [x] Add manual "Load previous task" button
- [x] Allow chained loading to skip failed tasks
- **Status:** complete

### Phase 6: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. What are the actual performance bottlenecks? (DB queries, frontend rendering, network - all three per user)
2. How should failed task logs be handled in chained loading? (Show error + allow manual skip per user)
3. What loading states need visual feedback? (Initial load, pagination, prepending tasks, SSE reconnection)
4. Should we use virtual scrolling for long logs? (Yes, for 1000+ lines to prevent render lag)

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Add performance logging first | Need data to identify actual bottlenecks before optimizing |
| Use react-window for virtual scrolling | Proven library, handles edge cases, maintains scroll position |
| Add skeleton loaders during connecting state | Prevents layout shift and shows progress |
| Allow manual skip for failed tasks | User control when auto-recovery fails |
| Batch agent log writes (10 lines / 500ms) | Reduce DB round trips without delaying logs too much |
| Add IntersectionObserver for scroll triggers | More efficient than scroll event handlers |
| Debounce scroll handling (100ms) | Reduce event handler overhead |
| Add CSS animations with prefers-reduced-motion | Smooth UX while respecting accessibility |

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
