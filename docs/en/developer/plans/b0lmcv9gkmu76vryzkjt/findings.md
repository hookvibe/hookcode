# Findings & Decisions: Task composer actions menu

{/* Link discoveries to code changes via this session hash. b0lmcv9gkmu76vryzkjt */}

## Session Metadata
- **Session Hash:** b0lmcv9gkmu76vryzkjt
- **Created:** 2026-02-04

## Requirements
- Replace the task group composer timer button with an actions popover.
- The popover should include the existing timer/time-window action and a new “start preview” action.
- After dependency installation completes, automatically start preview.

## Research Findings
- Pending code exploration for composer/time button and preview install/start flow.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use a composer actions popover with TimeWindowPicker + preview start button. | Matches the requirement for multiple actions without expanding the composer UI. |
| Share preview start logic between manual start and dependency reinstall flows. | Keeps start/refresh behavior consistent while enabling auto-start. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- docs/en/developer/plans/b0lmcv9gkmu76vryzkjt/task_plan.md

## Visual/Browser Findings
- None.

## Update 1 (2026-02-04)
- The composer time-window button lives in `frontend/src/pages/TaskGroupChatPage.tsx` within `.hc-composer-footer-left`, rendered as a `Popover` wrapping a `Button` with `ClockCircleOutlined`.
- The time-window picker component is `TimeWindowPicker` and shows the existing time window settings.

## Update 2 (2026-02-04)
- Preview start/stop handlers live in `TaskGroupChatPage.tsx` (`handlePreviewToggle`, `handlePreviewStart`).
- Dependency reinstall flow is `handlePreviewReinstall`, which currently refreshes preview status but does not auto-start preview.

## Update 3 (2026-02-04)
- Composer footer styling is in `frontend/src/styles/composer.css`, with `.hc-composer-footer-left` and `.hc-timewindow-toggle` styles.

## Update 4 (2026-02-04)
- Implemented a composer actions popover that embeds the time-window picker and a preview start action; preview dependency reinstall now auto-starts the preview via shared start logic.

## Update 5 (2026-02-04)
- Added a changelog entry for this session and confirmed all tests pass after the composer action updates.
