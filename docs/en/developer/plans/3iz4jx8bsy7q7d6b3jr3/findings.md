# Findings & Decisions: Tasks List Page Redesign and Active Filter Status Surfacing
{/* Translate remaining Chinese content to English for docs/en consistency. docsentrans20260121 */}
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. 3iz4jx8bsy7q7d6b3jr3 */}

## Session Metadata
- **Session Hash:** 3iz4jx8bsy7q7d6b3jr3
- **Created:** 2026-01-20

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Redesign `#/tasks` list page so users can identify the active filter status without reading the URL. {/* Capture user-visible pain point + desired outcome. 3iz4jx8bsy7q7d6b3jr3 */}
- Keep the page usable via deep links like `#/tasks?status=success` and (optionally) `#/tasks?repoId=...`. {/* Preserve existing routing behavior. 3iz4jx8bsy7q7d6b3jr3 */}
- New user-facing strings must be i18n'ed; UI must work in light/dark themes and respect configurable accent color. {/* Frontend constraints from AGENTS.md. 3iz4jx8bsy7q7d6b3jr3 */}
- Loading states should use AntD `Skeleton` (not spinner-only placeholders). {/* Enforce skeleton waiting UI guideline. 3iz4jx8bsy7q7d6b3jr3 */}

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `frontend/src/pages/TasksPage.tsx` already supports reading `status` from hash query and normalizes legacy `completed` → `success`, but the UI does not show the active filter anywhere. {/* Root cause summary. 3iz4jx8bsy7q7d6b3jr3 */}
- Router helpers `buildTasksHash({ status, repoId })` and `parseRoute` already support `#/tasks?status=...&repoId=...`. {/* Confirm navigation primitives exist. 3iz4jx8bsy7q7d6b3jr3 */}
- Frontend API exposes `/tasks/stats` via `fetchTaskStats()` (total/queued/processing/success/failed), which can power a status summary + filter UI independent of list limits. {/* Identify correct data source for counts. 3iz4jx8bsy7q7d6b3jr3 */}
- Existing unit tests cover TasksPage list fetching, search filtering, and retry button behavior; they will need updates once stats/filter UI is added. {/* Testing impact. 3iz4jx8bsy7q7d6b3jr3 */}

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add a compact status filter strip (All / Queued / Processing / Success / Failed) with counts | Makes the current filter immediately visible and enables quick switching. |
| Display the active filter (and repo scope, if any) in `PageNav` meta | Keeps the state discoverable even when the list is empty. |
| Fetch stats and list in parallel with independent loading skeletons | Avoids blocking the list rendering while totals are loading. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/src/pages/TasksPage.tsx` (current list UI + status normalization)
- `frontend/src/api.ts` (`fetchTasks`, `fetchTaskStats`)
- `frontend/src/router.ts` (`buildTasksHash`, `parseRoute`)
- `frontend/src/tests/tasksPage.test.tsx` (existing unit tests)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
