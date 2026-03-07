# Findings & Decisions: Disable stale processing when PROCESSING_STALE_MS is blank



# Findings & Decisions: Disable stale processing when PROCESSING_STALE_MS is blank
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. stale-disable-20260305 */}

## Session Metadata
- **Session Hash:** stale-disable-20260305
- **Created:** 2026-03-05

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Keep `PROCESSING_STALE_MS` configurable but allow blank/unset to mean "no stale timeout".
- Avoid auto-failing `processing` tasks when the user intentionally leaves the value blank.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `PROCESSING_STALE_MS` is parsed with `Number(value)`, so an empty string becomes `0` and immediately triggers stale recovery.
- `recoverStaleProcessing` runs in both `backend/src/bootstrap.ts` and `backend/src/worker.ts`, so disable logic must be shared there.
- `PROCESSING_STALE_MS` is also referenced in task retry and queue stats; they must remain consistent when the timeout is disabled.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|---|---|
| Treat blank/undefined/0 `PROCESSING_STALE_MS` as "disable stale recovery", but keep the default when truly unset. | Matches user intent (no timeout) while preserving explicit numeric timeouts. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|---|---|
| `init-session.sh` reported `docs.json` missing `navigation.languages[]` | Logged as non-blocking; continue without docs.json sync. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `backend/src/bootstrap.ts`
- `backend/src/worker.ts`
- `backend/src/modules/tasks/task.service.ts`
- `backend/src/modules/tasks/tasks.controller.ts`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-
