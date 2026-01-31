# Findings & Decisions: Handle frontend network fluctuation toast



# Findings & Decisions: Handle frontend network fluctuation toast
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. netflapui20260126 */}

## Session Metadata
- **Session Hash:** netflapui20260126
- **Created:** 2026-01-26

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
<!-- Record initial requirements for stabilizing network error UX. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- When network is unstable on the task group frontend page, show a reminder instead of forcing a full page reload.
- Avoid repeated, stacking "connection failed" prompts; use throttling/deduping.
- Preserve current page state during transient disconnects and guide the user to retry when stable.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
<!-- Note immediate discoveries before code exploration. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- User reports network flaps currently trigger repeated top-of-page failure prompts and full refreshes on the task group page.
<!-- Capture initial file locations for task group chat and error toasts. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- Task group chat view lives in `frontend/src/pages/TaskGroupChatPage.tsx`, with error toasts like `toast.chat.groupLoadFailed`.
<!-- Note polling and toast behavior that can amplify network flaps. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- Task group detail refresh polls every 5 seconds and calls `message.error` on `refreshGroupDetail` failure, which can spam toasts during intermittent connectivity.
<!-- Capture global API redirect behavior for authentication failures. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- `frontend/src/api.ts` only redirects to `#/login` on 401; network errors do not trigger reloads there.
<!-- Note existing log viewer copy for auto-reconnect messaging. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- i18n already includes log viewer messaging like `logViewer.error.autoReconnect` ("连接异常，正在自动重连…") which suggests a reconnect-friendly UX pattern.
<!-- Capture existing TaskGroupChatPage tests for adding coverage. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- `frontend/src/tests/taskGroupChatPage.test.tsx` covers TaskGroupChatPage behaviors but currently has no test for preserving data on refresh failures or throttling network warnings.
<!-- Track test script discovery for later execution. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126 -->
- Root `package.json` has no test script; frontend tests likely need to be run from the `frontend` workspace.

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

## Session Metadata
- **Session Hash:** netflapui20260126
- **Created:** 2026-01-26

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
