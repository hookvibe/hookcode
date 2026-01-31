# Findings & Decisions: Task group transition animation
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. taskgrouptransition20260123 */}

## Session Metadata
- **Session Hash:** taskgrouptransition20260123
- **Created:** 2026-01-23

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- When creating a new task group, after clicking send, show the question in its final position immediately.
- Replace the skeleton-only wait state with a smoother transition animation during task-group execution.
- The transition should feel better than a static skeleton placeholder.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Task-group chat UI is implemented in `frontend/src/pages/TaskGroupChatPage.tsx`, including the send flow and skeleton rendering.
- Skeleton timeline is rendered when `groupLoading && taskGroupId` via `ChatTimelineSkeleton` in the chat body.
- `handleSend` inserts the new task into local state, but a route change triggers `refreshGroupDetail` with `mode: 'blocking'`, which sets `groupLoading` and shows the skeleton.
- `refreshGroupDetail` uses `groupRef` to avoid blocking loading for polling; `shouldBlock` is `mode === 'blocking' || !groupRef.current`.
- `ChatTimelineSkeleton` renders placeholder task/chat rows with AntD `Skeleton` and `Card` components.
- `TaskConversationItem` renders the real chat timeline item (user bubble + task/log cards), so showing it immediately would satisfy the "final position" requirement.
- `TaskConversationItem` is only referenced by `TaskGroupChatPage`, so adding optional props won't affect other views.
- `extractTaskUserText` reads the chat payload from `task.payload.__chat.text` and falls back to notes/comments/title; missing input displays `chat.message.userTextFallback`.
- Chat timeline layout and item styling live in `frontend/src/styles.css` under the "Chat view (task group)" section.
- Tests in `frontend/src/tests/taskGroupChatPage.test.tsx` assert the skeleton appears during blocking load and clears when navigating away.
- Frontend tests run via `pnpm --filter hookcode-frontend test` (Vitest).
- Changelog updates are recorded in `docs/en/change-log/0.0.0.md` for this session.

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
- package.json
- frontend/package.json
- docs/en/change-log/0.0.0.md
- frontend/src/pages/TaskGroupChatPage.tsx
- frontend/src/components/skeletons/ChatTimelineSkeleton.tsx
- frontend/src/components/chat/TaskConversationItem.tsx
- frontend/src/styles.css
- frontend/src/tests/taskGroupChatPage.test.tsx
- frontend/src/utils/task.tsx
- frontend/src/i18n/messages/en-US.ts

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist. Must be captured as text. WHEN: IMMEDIATELY after viewing images, PDFs, or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- None.
