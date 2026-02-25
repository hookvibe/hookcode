# Findings & Decisions: preview highlight logic review



# Findings & Decisions: preview highlight logic review
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. ue5f7ky5wnpsopa2ak8w */}

## Session Metadata
- **Session Hash:** ue5f7ky5wnpsopa2ak8w
- **Created:** 2026-02-02

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Read the backend logic for `/api/task-groups/:id/preview/start`.
- Read the bridge implementation in `shared/preview-bridge.js`.
- Summarize the current highlight flow for follow-up tasks.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The preview highlight flow includes `GET /api/task-groups/:id/preview/status`, `POST /api/task-groups/:id/preview/start`, and `POST /api/task-groups/:id/preview/:instance/highlight`.
- The preview bridge must answer a `hookcode:preview:ping` handshake before highlight commands are forwarded; a `subscribers: 0` response usually indicates the bridge is not connected.
- `POST /api/task-groups/:id/preview/start` is implemented in `backend/src/modules/tasks/task-group-preview.controller.ts` and delegates to `previewService.startPreview`, returning `{ success: true, instances }` on success and mapping `PreviewServiceError` via `handleError`.
- Highlight requests validate the target instance status (`running` or `starting`) before publishing via `previewHighlight.publishHighlight`, and return `subscribers` in the response.
- `previewService.startPreview` uses a per-task-group lock to prevent concurrent starts, then calls `startPreviewInternal`, which resolves preview config, stops any running instances, installs dependencies if needed, starts each configured instance, and returns a snapshot of instance status.
- `shared/preview-bridge.js` listens for `hookcode:preview:*` postMessage events, replies to `ping` with `pong`, and only accepts subsequent `highlight`/`clear` commands from the first allowed origin.
- The bridge renders either an outline overlay or a page mask, supports padding/color/mode/scrollIntoView, and keeps the highlight synced on scroll/resize/element resize.
- `PreviewHighlightService` publishes `preview.highlight` events to `preview-highlight:${taskGroupId}` with a generated `requestId` and includes the current SSE subscriber count.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `.codex/skills/hookcode-preview-highlight/SKILL.md`
- `backend/src/modules/tasks/task-group-preview.controller.ts`
- `backend/src/modules/tasks/preview-highlight.service.ts`
- `shared/preview-bridge.js`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## Session Metadata
- **Session Hash:** ue5f7ky5wnpsopa2ak8w
- **Created:** 2026-02-02

## Requirements


-

## Research Findings


-

## Technical Decisions


| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered


| Issue | Resolution |
|-------|------------|
|       |            |

## Resources


-

## Visual/Browser Findings



-

---

*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
