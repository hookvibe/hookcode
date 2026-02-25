# Findings & Decisions: enhance preview highlight with bubble



# Findings & Decisions: enhance preview highlight with bubble
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. jemhyxnaw3lt4qbxtr48 */}

## Session Metadata
- **Session Hash:** jemhyxnaw3lt4qbxtr48
- **Created:** 2026-02-02

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Enhance preview highlight visuals.
- Add bubble tooltip rendering next to highlighted element via an API payload.
- Update `shared/preview-bridge.js` to support the new display behavior.
- Update hookcode-preview-highlight docs with more detailed parameter descriptions.
- Add tests for new feature behavior.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `hookcode-preview-highlight` skill documents the highlight API and CLI scripts, including current parameters (`selector`, `padding`, `color`, `mode`, `scrollIntoView`, `requestId`).
- The protocol reference doc `references/highlight-protocol.md` describes the HTTP highlight request/response and `postMessage` bridge message types/payloads.
- Highlight request DTOs live in `backend/src/modules/tasks/dto/task-group-preview.dto.ts` and currently validate selector/padding/color/mode/scrollIntoView/requestId.
- The frontend forwards highlight events in `frontend/src/pages/TaskGroupChatPage.tsx` via `postMessage` and listens on the SSE topic `preview-highlight:${taskGroupId}`; related tests exist in `frontend/src/tests/taskGroupChatPage.test.tsx`.
- The highlight SSE test expects a `hookcode:preview:highlight` postMessage that forwards `payload.command` directly into the iframe.
- Frontend types for highlight commands/events live in `frontend/src/api.ts` and will need updates for any new bubble payload fields.
- Backend unit test `backend/src/tests/unit/previewHighlightService.test.ts` covers publish behavior and may need adjustments if payload shape changes.
- The CLI highlight script `preview_highlight.mjs` builds the highlight payload from flags and posts to `/api/task-groups/:id/preview/:instance/highlight`.
- `shared/preview-bridge.js` currently renders a fixed overlay and optional mask, with scroll/resize tracking and no bubble UI.
- Backend DTOs use `@ValidateNested` with `class-transformer` `@Type` for nested objects (see `backend/src/modules/tasks/dto/chat-swagger.dto.ts`), which can be reused for a bubble payload object.
- Backend highlight command types are defined in `backend/src/modules/tasks/preview.types.ts` and must be extended alongside DTOs to carry bubble payloads.
- The CLI helper utilities (`_shared.mjs`) already support parsing booleans/numbers, so bubble-related flags can reuse them in `preview_highlight.mjs`.
- UI/UX guidance from ui-ux-pro-max: use glassmorphism for overlays (blur 10-20px, subtle border), limit continuous animations, honor `prefers-reduced-motion`, and keep micro-animations within 150-300ms.
- The preview iframe in `frontend/src/pages/TaskGroupChatPage.tsx` has no `sandbox` attribute; link clicks will navigate inside the iframe unless the link uses `target=_blank` or top-level navigation is triggered.
- The parent computes `previewIframeOrigin` from the initial `previewIframeSrc`; if the iframe navigates to a different origin, the preview bridge handshake/highlight messaging can stop working.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add an optional `bubble` object to the highlight command payload (text + placement + styling) and render it in `shared/preview-bridge.js` | Keeps a single API for highlight+tooltip and preserves backward compatibility for existing highlight calls. |
| Improve highlight visuals via richer overlay styling (glow, smoother transitions) without changing default API fields | Meets the "optimize highlight display" requirement while avoiding breaking API changes. |

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
- `.codex/skills/hookcode-preview-highlight/references/highlight-protocol.md`
- `backend/src/modules/tasks/dto/task-group-preview.dto.ts`
- `backend/src/modules/tasks/preview.types.ts`
- `shared/preview-bridge.js`
- `frontend/src/api.ts`
- `frontend/src/tests/taskGroupChatPage.test.tsx`
- `backend/src/tests/unit/previewHighlightService.test.ts`

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
- **Session Hash:** jemhyxnaw3lt4qbxtr48
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
