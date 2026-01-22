# Findings & Decisions: TaskGroup inline ThoughtChain + reverse paging

{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. taskgroupthoughtchain20260121 */}

## Session Metadata
- **Session Hash:** taskgroupthoughtchain20260121
- **Created:** 2026-01-22

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Remove the "Expand thought chain" (expand/collapse logs) UI from the TaskGroup chat page.
- Render each task's ThoughtChain inline, matching the Task Detail page's log presentation.
- Add reverse paging in TaskGroup chat: default show the latest 3 tasks; scrolling upward reveals older tasks.
- Default scroll position should be at the bottom (latest tasks), and loading older tasks must preserve scroll position.
- Fix the React hook-order crash in `ExecutionTimeline` so toggling/streaming cannot trigger "Rendered more hooks than during the previous render."

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `TaskGroupChatPage` renders tasks inside `.hc-chat-body` which is the single scroll container (`overflow: auto` in `frontend/src/styles.css`). The timeline itself is not scrollable.
- The current expand/collapse UX lives in `frontend/src/components/chat/TaskConversationItem.tsx` via `logsExpanded` + a toggle button and `TaskLogViewer`.
- The hook-order crash comes from `frontend/src/components/execution/ExecutionTimeline.tsx`: it early-returns before calling the second `useMemo` (building `chainItems`) when `visibleItems` is empty, which violates the Rules of Hooks when `visibleItems` later becomes non-empty during streaming/filtering.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Use `TaskLogViewer` with `variant="flat"` in TaskGroup chat items and remove the expand/collapse toggle. | Matches Task Detail UX and avoids incompatible expand state while keeping only one scroller. |
| Implement reverse paging by hiding older tasks (page size = 3) and revealing them when the chat body scroll reaches near-top, while preserving scroll position. | Prevents the page from being too long by default and avoids scroll jumps when prepending content. |
| Fix `ExecutionTimeline` by making hook execution unconditional (no early return before building `chainItems`). | Prevents the React hook-order crash when filtered items change over time. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/src/pages/TaskGroupChatPage.tsx` (TaskGroup chat page)
- `frontend/src/components/chat/TaskConversationItem.tsx` (expand/collapse logs UI to remove)
- `frontend/src/components/TaskLogViewer.tsx` (`variant="flat"` matches Task Detail)
- `frontend/src/components/execution/ExecutionTimeline.tsx` (hook-order crash location)
- `frontend/src/styles.css` (`.hc-chat-body` is the scroll container)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- N/A (no screenshots or external browsing required for this task).
