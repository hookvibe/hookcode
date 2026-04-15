# Findings & Decisions: Add notification target links
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}
{/* Keep the recorder findings template single-pass so new sessions do not duplicate sections. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320 */}

{/* Link discoveries to code changes via this session hash. cv3zazhx2a716nfc0wn9 */}

## Session Metadata
- **Session Hash:** cv3zazhx2a716nfc0wn9
- **Created:** 2026-04-15

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Implement notification links so users can navigate from a notification to its matching destination.
- Use relative hash links for in-app targets so navigation stays inside the SPA router.
- Preserve the original absolute URL for external targets.
- Reuse an existing session hash if one already exists for this task; otherwise create a new authoritative session.
- Return the recorder-style response containing only `STATUS`, `SESSION_HASH`, `TOUCHED_FILES`, and `BLOCKERS`.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `.codex/agents/planning_recorder.toml` defines `INIT_SESSION` to initialize or reuse a session and requires the response format with `STATUS`, `SESSION_HASH`, `TOUCHED_FILES`, and `BLOCKERS`.
- `.codex/agents/planning-recorder/scripts/init-session.sh` creates the session folder, hydrates the three plan templates, and syncs `docs/docs.json` when present.
- Repository search did not find an existing plan session titled `Add notification target links` or another plan already describing this notification-link goal, so a new session was required.
- The generated authoritative session hash for this task is `cv3zazhx2a716nfc0wn9`.
- `backend/prisma/schema.prisma` shows that `Notification` currently stores ids, message, context, `meta`, and timestamps but has no dedicated link column, so the feature requires a schema and migration update.
- `backend/src/modules/tasks/task-runner.service.ts` is the current notification producer and already has `task.id` at emission time, so task-result notifications can reliably point at `#/tasks/:taskId`.
- `frontend/src/components/notifications/NotificationsPopover.tsx` and `frontend/src/components/settings/SettingsNotificationsPanel.tsx` are the only current notification consumers and both render plain message text today.
- `frontend/src/router.ts` already exports `buildTaskHash(taskId)`, which is the correct frontend source of truth for in-app task hashes.
- Existing frontend tests cover popover read-all behavior and notifications-table pagination, but they do not yet cover link navigation.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Use the repo's planning-recorder assets instead of manually creating files. | This matches the recorder protocol and keeps initialization behavior consistent with future sessions. |
| Record the task as a five-phase implementation plan. | The feature touches discovery, routing design, implementation, testing, and delivery, so the standard phased structure is appropriate. |
| Add a nullable `linkUrl` field to the notification contract and persistence model. | The backend and frontend both need a single canonical destination field, and nullable storage keeps older rows valid. |
| Prefer backend link generation over frontend message inspection. | Notification producers already know the business target, while the UI should only decide how to navigate a provided link. |
| Keep task notifications on the internal task detail hash even when provider metadata also contains an external URL. | The request says current-system links use relative URLs, and task detail is the stable in-app landing page for existing notification types. |
| Backfill historical task notifications with `#/tasks/<taskId>` during the migration. | Existing task-result alerts should become clickable without waiting for fresh notifications to be emitted. |
| Render notification messages through a shared frontend link component instead of duplicating table and popover logic. | One validation and click path keeps internal hash navigation and external anchors consistent across surfaces. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| No reusable prior session was found for the requested title/goal. | Initialized a new authoritative session and recorded the new session hash for future continuation. |
| Recorder transport appears one-way after session creation. | Continue syncing by using the authoritative on-disk plan files and verifying the session folder before code changes. |
| Historical notifications without task ids or valid external URLs still lack a safe navigation target. | Leave them as plain text until a future producer can populate `linkUrl` with a valid in-app or absolute destination. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `.codex/agents/planning_recorder.toml`
- `.codex/agents/planning-recorder/scripts/init-session.sh`
- `docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md`
- `docs/en/developer/plans/cv3zazhx2a716nfc0wn9/findings.md`
- `docs/en/developer/plans/cv3zazhx2a716nfc0wn9/progress.md`
- `docs/docs.json`
- `backend/prisma/schema.prisma`
- `backend/src/modules/tasks/task-runner.service.ts`
- `backend/src/modules/notifications/notifications.service.ts`
- `frontend/src/components/notifications/NotificationsPopover.tsx`
- `frontend/src/components/settings/SettingsNotificationsPanel.tsx`
- `frontend/src/router.ts`
- `frontend/src/tests/notificationsPopover.test.tsx`
- `backend/src/modules/notifications/notification-links.ts`
- `backend/src/tests/unit/notificationLinks.test.ts`
- `frontend/src/components/notifications/NotificationMessageLink.tsx`
- `frontend/src/utils/notificationLinks.ts`
- `frontend/src/tests/settingsNotificationsPanel.test.tsx`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- No visual or browser-based inspection was needed for this bookkeeping-only initialization.

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
