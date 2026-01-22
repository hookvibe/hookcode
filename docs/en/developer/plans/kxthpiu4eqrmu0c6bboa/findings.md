# Findings & Decisions: Implement reusable SSE change notifications (Route A)
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. kxthpiu4eqrmu0c6bboa */}

## Session Metadata
- **Session Hash:** kxthpiu4eqrmu0c6bboa
- **Created:** 2026-01-17

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
{/* Capture SSE Route A requirements from user request. kxthpiu4eqrmu0c6bboa */}
- Implement Route A: server-side polling detects dashboard changes and broadcasts SSE "changed" notifications.
- SSE implementation must be efficient (shared poller, no per-client DB polling) and reusable for future push use-cases.
- Frontend should subscribe to SSE and refresh `/dashboard/sidebar` only on notifications, with a robust polling fallback.
- Auth must work with browser `EventSource` (support `?token=` via `AllowQueryToken`).

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
{/* Record relevant existing patterns in the codebase. kxthpiu4eqrmu0c6bboa */}
- Backend already implements SSE for task logs (`GET /tasks/:id/logs/stream`) including a DB polling fallback and heartbeat keep-alive.
- Frontend uses `EventSource` for task logs and passes auth via query string because headers are not supported.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add `/events/stream` as a global SSE channel with `topics=` filtering | Enables future push-based features without adding more polling endpoints or multiple EventSource connections per page. |
| Use a DB-polled change token (counts + top-N ids) for `dashboard.sidebar.changed` | Avoids noisy notifications from log writes while keeping sidebar counts and membership accurate. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| Vite dev server returns 404 for `/api/events/stream` | Add a Vite `server.proxy` rule for `/api` so `VITE_API_BASE_URL=/api` works for SSE and REST during local dev. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
-

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
