# Task Plan: Refactor worker file diff visibility into HookCode
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. worker-file-diff-ui-20260316 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** worker-file-diff-ui-20260316
- **Created:** 2026-03-16

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Refactor HookCode so worker-driven task execution captures repository file changes and diffs in real time, persists the latest change snapshot in task results, and renders a ClaudeCodeUI-style compact execution surface with file/diff inspection in both task-group and task-detail views.

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
- [x] Replace worker shell-only execution with shared runtime envelope handling
- [x] Persist workspace change snapshots and expose them to frontend APIs
- [x] Add TaskGroup/TaskDetail change panels with ClaudeCodeUI-style diff presentation
- [x] Rework the execution area chrome to match ClaudeCodeUI's compact tool-card layout
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
1. How should worker execution reuse backend agent logic without preserving the old backend-first execution contract?
2. What result payload shape lets the frontend render real-time file diffs while still surviving page refreshes?
3. Which existing HookCode timeline and diff components can be reused so the UI matches ClaudeCodeUI without introducing a second rendering stack?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Restrict file change capture to repository-relative paths only | The user explicitly accepted repo-only scope, and git-native capture is more reliable than whole-workspace snapshots. |
| Reuse task log JSON events plus a persisted `workspaceChanges` task-result snapshot | SSE logs already drive the live timeline, while task results are needed for reload/history views. |
| Use TaskGroup workspace tabs and TaskDetail main execution area as the two UI surfaces | These are the existing places where users inspect active and completed worker output. |
| Hide internal `hookcode.workspace.snapshot` transport lines from raw log rendering once a dedicated workspace diff panel exists | The JSON event is implementation detail noise after the file rail + diff viewer can render the same data directly. |
| Keep HookCode's existing `DiffView` renderer and restyle the surrounding chrome instead of importing a new diff stack | This preserves the current diff semantics while letting the execution area visually converge on ClaudeCodeUI. |
| Derive compact `+/-` line statistics in the frontend from `oldText/newText` or `unifiedDiff` instead of extending the API again | The UI needs Git-style change magnitude cues, but the existing snapshot payload already contains enough information to calculate them locally. |
| Keep the existing execution-timeline structure but restyle it into dense tool cards with localized file pills and change metrics | This avoids parser churn while making the timeline visually consistent with the new workspace diff panel. |
| On narrow viewports, switch the workspace file rail to horizontal scroll cards instead of stacking the legacy vertical list | That preserves fast file switching in the compact execution area without forcing the diff viewer too far below the fold on mobile widths. |
| Show compact trailing path segments in the execution chrome while exposing the full path via `title` attributes | Dense worker UI should preserve the actionable filename first, but users still need the complete repository path when inspecting deep trees. |
| Let long diff/output lines prefer horizontal scroll on desktop while automatically wrapping on narrow screens, and keep diff hunk headers sticky inside scroll containers | Large worker patches need desktop scanability without losing readability on mobile-sized panes. |
| Prefer parsing worker-provided `unifiedDiff` before attempting any frontend `oldText/newText` diff calculation | The worker already emits git-accurate patch text, so reusing it avoids redundant CPU work and prevents large-file UI stalls. |
| Apply one shared preview-cap component to command output, raw diff fallbacks, flat raw logs, and unknown JSON payloads | This closes the remaining DOM-bloat gap consistently instead of fixing oversized text rendering one surface at a time. |
| Add keyboard navigation plus auto-scroll-to-active behavior to the workspace file rail | Dense Claude-style file rails need non-pointer navigation and active-card visibility to stay usable once worker runs touch many files. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| New-file and delete-file diff commands produced absolute-path patches or missing output in real git repos | 1 | Switched create diffs to repo-relative `git diff --no-index /dev/null <path>` and delete diffs to `git diff HEAD -- <path>` in both backend and worker trackers |
| Compact diff markup caused frontend tests to match multiple nested text nodes | 1 | Updated the workspace diff test to assert active file selection plus `getAllByText(...)` content presence instead of a single-node text match |
| `DiffView` briefly fell back to raw preview when fixtures only provided `diff --git ...` headers plus `old/newText` | 1 | Changed the unified-diff-first path to fall back to preview-limited inline `old/newText` rendering whenever a parseable hunk is unavailable but text bodies still exist |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
