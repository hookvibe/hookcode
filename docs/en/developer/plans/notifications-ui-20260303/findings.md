# Findings & Decisions: Notifications UX improvements
<!-- Capture requirements and discovery notes for notifications UX updates. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303 -->

## Session Metadata
- **Session Hash:** notifications-ui-20260303
- **Created:** 2026-03-03

## Requirements
- Opening the header notifications popover should mark messages as read when unread exist.
- Clicking "mark all read" should close the notifications popover.
- User settings page top nav should show a notification icon on the far right, except on the notifications tab.
- Notifications and logs tables in settings should use pagination (no manual "load more" only).

## Research Findings
<!-- Update discovery on popover behavior and settings tables. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303 -->
- `NotificationsPopover` only marks read via the "mark all read" button and does not auto-mark on open or close the popover after marking.
- `UserSettingsPage` uses `PageNav` without a `userPanel`, so the notifications icon is missing on settings pages.
- `SettingsNotificationsPanel` uses an AntD `Table` without pagination, relying on cursor-based "Load more" instead.
- `SettingsLogsPanel` also uses a `Table` without pagination and a manual "Load more" button with cursor-based fetches.
- `UserSettingsPage` renders `PageNav` without a `userPanel` prop, so there is no notification icon in the settings top nav.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use cursor-backed table pagination with a virtual next page | Replaces manual \"Load more\" while preserving existing APIs |
| Render settings nav notifications icon except notifications tab | Avoids redundant icon on the notifications view |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| init-session script error: `docs.json` missing `navigation.languages[]` | Logged; proceed without docs.json sync |

## Resources
- `frontend/src/components/notifications/NotificationsPopover.tsx`
- `frontend/src/components/settings/SettingsNotificationsPanel.tsx`
- `frontend/src/components/settings/SettingsLogsPanel.tsx`
- `frontend/src/pages/UserSettingsPage.tsx`
