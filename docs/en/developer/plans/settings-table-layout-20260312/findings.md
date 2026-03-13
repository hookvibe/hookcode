# Findings & Decisions: Relax settings table width and fix executor dialog theme
{/* Capture requirements and repo discoveries for the settings table work. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312 */}

## Session Metadata
- **Session Hash:** settings-table-layout-20260312
- **Created:** 2026-03-12

## Requirements
- Settings pages with wide tables, specifically Notifications, Executors, and Logs, should not be limited by the settings page max width.
- Table content may overflow horizontally so more columns remain visible.
- The last operations column must stay fixed on screen while the rest of the table scrolls.
- An executor dialog currently appears black and should be updated to match the application theme.

## Constraints
- Follow the planning workflow under `docs/en/developer/plans/settings-table-layout-20260312/`.
- Add traceability comments to every changed code area.
- Prefer reusing existing layout or table helpers instead of duplicating UI logic.
- Add or update tests for the frontend change and run the full frontend test suite after adding tests.

## Discoveries
- `init-session.sh` created the plan files successfully before failing because `docs/docs.json` uses `navigation.tabs` instead of `navigation.languages`.
- The relevant frontend scope lives under `frontend/src/components/settings/` with candidate panels in `SettingsNotificationsPanel.tsx`, `SettingsWorkersPanel.tsx`, and `SettingsLogsPanel.tsx`.
- Shared styles live in `frontend/src/styles/settings-layout.css`, `frontend/src/styles/settings.css`, and `frontend/src/styles/antd-overrides.css`.
- `frontend/src/pages/UserSettingsPage.tsx` wraps every settings tab inside a shared `.hc-settings-tab-content` container.
- `frontend/src/styles/settings-layout.css` enforces `max-width: 1000px` on `.hc-settings-page .hc-settings-tab-content`, so table-heavy tabs inherit the narrow centered layout by default.
- The Notifications, Workers, and Logs panels each render a plain Ant Design `Table` without horizontal scroll or sticky action-column configuration.
- `SettingsWorkersPanel.tsx` renders the create and prepare dialogs with raw `Modal` components and no theme class, while the project already defines themed dialog styles under `.hc-dialog--compact` in `frontend/src/styles/antd-overrides.css`.
- Existing frontend tests already cover settings notifications, workers, and logs, so extending those tests is lower-risk than building a new harness.

## Decisions
- Use a shared-layout-first fix by tagging only the table-heavy settings tabs as full-width in `UserSettingsPage.tsx`.
- Reuse a shared settings layout module for wide-tab detection and table scroll constants.
- Apply horizontal table scroll to Notifications, Workers, and Logs, and fix the workers action column to the right with Ant Design’s `fixed: 'right'` behavior.
- Reuse `.hc-dialog--compact` for worker dialogs instead of inventing a new modal theme.
- Keep documentation updates limited to the planning index and changelog because no end-user doc page describes this layout behavior today.

## Final Outcome
- The settings page now keeps normal form tabs centered while letting Notifications, Workers, and Logs expand to the full content width.
- Wide tables use horizontal scrolling instead of compressing important columns.
- The workers action column stays fixed on the right edge of the table.
- Worker create and prepare dialogs now reuse the shared compact theme surface, removing the mismatched black dialog.

## Refinement Update 2026-03-12
- The user clarified that wide settings tables should not stretch edge-to-edge; they should exceed the old `1000px` cap while remaining centered in the page content area.
- Other settings tabs must keep the existing narrow max-width behavior.

- The final layout keeps Notifications/Workers/Logs centered with a `1480px` max width instead of stretching edge-to-edge; other settings tabs remain at the original `1000px` max width.

- `frontend/src/styles/page-nav.css` applies a shared `max-width: var(--hc-page-max)` rule to every direct child of `.hc-page__body`, so the app already has a page-width system that centered pages follow.
- The settings page adds its own narrower `1000px` cap on `.hc-settings-tab-content`, which means changing the whole tab container is a page-shell change, not a table-section change.
- The better fit for the user request is to keep the settings tab container centered/narrow and let only the table-heavy `hc-panel-section` break out wider while staying centered.

- The final implementation keeps `hc-settings-tab-content` at the normal centered settings width and applies the wider centered breakout only to the `hc-panel-section` for logs, notifications, and workers.

## Micro-tuning Update 2026-03-13
- The user requested another visual pass, so the breakout width should now be checked against the actual AppShell/settings shell spacing instead of using a coarse viewport-based subtraction.

- The micro-tuned version now passes the actual settings sidebar width into the page shell as a CSS custom property, so the breakout formula responds to the expanded `240px` sidebar and the collapsed `72px` sidebar.
- The breakout gutter now uses `clamp(96px, 7vw, 120px)` instead of a single hard-coded subtraction, which better matches the page shell padding across laptop and desktop widths.
