# Task Plan: Relax settings table width and fix executor dialog theme
{/* Define the frontend settings layout scope and verification plan. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312 */}

## Session Metadata
- **Session Hash:** settings-table-layout-20260312
- **Created:** 2026-03-12

## Goal
Update the settings pages so table-heavy views such as Notifications, Executors, and Logs are no longer constrained by the page max width, keep the rightmost actions column sticky while other columns scroll, and align the dark executor dialog with the active theme styling.

## Current Phase
Complete

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document initial findings in `findings.md`
- **Status:** complete

### Phase 2: Technical Approach
- [x] Locate the shared settings page shell and table wrappers
- [x] Decide whether to fix width at the page shell or per table section
- [x] Identify the executor dialog style source
- **Status:** complete

### Phase 3: Implementation
- [x] Relax the layout constraints for target settings pages
- [x] Keep the actions column sticky while table content scrolls horizontally
- [x] Update the executor dialog colors to use theme tokens
- [x] Refine the wide-table container so it stays centered while exceeding the old max-width
- [x] Micro-tune the breakout width against the real page shell spacing
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Add or update frontend tests for the new layout behavior
- [x] Run targeted tests first and then the broader frontend suite
- [x] Record verification results in `progress.md`
- [x] Re-run the relevant settings tests after the centering refinement
- [x] Re-run validation after the micro-tuned breakout formula
- **Status:** complete

### Phase 5: Delivery & Traceability
- [x] Update planning docs with final status
- [x] Add the changelog entry for this session
- [x] Summarize the user-facing result and remaining follow-ups
- **Status:** complete

## Key Questions
1. Which shared settings layout component currently enforces the max width for all settings tabs? — `UserSettingsPage.tsx` wraps every tab with `.hc-settings-tab-content`, and `settings-layout.css` sets `max-width: 1000px` there.
2. Are the Notifications, Executors, and Logs pages built on the same reusable table wrapper? — No shared table wrapper exists yet; each panel renders its own Ant Design `Table`, so the fix uses shared constants plus per-panel table props.
3. Which dialog component or class causes the executor modal to render with a dark background? — The worker create/prepare dialogs used raw `Modal` instances without the existing `.hc-dialog--compact` theme class.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with shared settings layout discovery before patching individual pages. | The user named multiple settings pages, so a shared container fix is likely safer and smaller. |
| Treat sticky actions as a table-level behavior rather than a page-level hack. | The requirement applies to the final operation column while keeping horizontal scrolling for the rest of the table. |
| Relax the width only for table-heavy tabs instead of all settings tabs. | Form-centric tabs still benefit from the centered readable max-width, while logs/notifications/workers need more room. |
| Reuse the existing `.hc-dialog--compact` dialog skin for worker modals. | The project already themes compact dialogs consistently, so adding the class is safer than introducing a new modal-specific theme. |
| Centralize the settings wide-tab and table-scroll constants in a shared module. | The same layout rules now apply across the page shell, multiple panels, and tests without duplicating literals. |
| Reuse a centered breakout section width of `min(1480px, max(100%, calc(100vw - sidebar - gutter)))` for table-heavy settings panels. | It keeps the wide table interface centered on the settings content axis, grows on large screens, and falls back to the normal width on tighter viewports. |
| Drive the breakout width from the persisted settings sidebar collapse state. | The settings page shell owns the real navigation width, so the breakout formula should react to the expanded vs collapsed sidebar instead of assuming a fixed sidebar offset. |
| Break out only the table-heavy settings sections instead of widening the entire tab container. | The frontend already has a centered page-width system, so only the logs/notifications/workers sections should exceed the normal settings width while the rest of the page logic stays unchanged. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]`. | 1 | Continued with the created session files manually and updated the plans index plus changelog by hand. |
| The first targeted Vitest command used repo-root-relative file paths, so Vitest reported `No test files found`. | 1 | Re-ran the targeted tests with package-relative paths under `frontend/src/tests/`. |

## Notes
- No user-facing docs page required content updates beyond the plans index and changelog because the change only adjusts existing settings UI behavior.
- Frontend build still reports the existing Vite chunk-size warning, but the build completed successfully and this task introduced no new build step or network I/O.
