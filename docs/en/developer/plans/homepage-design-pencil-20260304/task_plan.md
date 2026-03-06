## Task Plan: Design frontend homepage in pencil
<!-- Define the homepage recreation scope, phase flow, and traceability anchor for this design task. docs/en/developer/plans/homepage-design-pencil-20260304/task_plan.md homepage-design-pencil-20260304 -->

## Session Metadata
- **Session Hash:** homepage-design-pencil-20260304
- **Created:** 2026-03-04

## Goal
Recreate the current frontend homepage in `design.pen` with Pencil MCP (desktop + mobile boards), matching the live layout structure and core visual hierarchy used by the app.

## Current Phase
Completed

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm user intent and output target (`design.pen`).
- [x] Identify homepage route entry and primary shell component.
- [x] Record constraints and issues in planning files.
- **Status:** complete

### Phase 2: Structure Mapping
- [x] Read homepage-related components/styles and map sections to design blocks.
- [x] Decide desktop frame size, spacing, and typography equivalents for Pencil canvas.
- **Status:** complete

### Phase 3: Pencil Implementation
- [x] Open/create target design document in Pencil MCP.
- [x] Draw homepage frame and section hierarchy (sidebar/header/content/cards/lists).
- [x] Apply approximate text, color, spacing, and component shapes.
- **Status:** complete

### Phase 4: Verification
- [x] Capture screenshot of rendered frame.
- [x] Compare against frontend homepage intent and fix visible layout issues.
- [x] Record verification details in `progress.md`.
- **Status:** complete

### Phase 5: Delivery
- [x] Update changelog with session hash and plan link.
- [x] Ensure plan/findings/progress are complete and consistent.
- [x] Deliver summary to user.
- **Status:** complete

### Phase 6: Mobile Board Extension
- [x] Capture mobile-specific layout rules from current frontend styles/components.
- [x] Draw a dedicated mobile homepage board in `design.pen`.
- [x] Verify mobile board screenshot and update docs/changelog.
- **Status:** complete

## Key Questions
1. Which concrete UI branch is treated as "homepage" for this repository today (`#/`)?
2. Which sections are essential to preserve for a faithful design representation versus optional details?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `frontend/src/router.ts` + `frontend/src/pages/AppShell.tsx` as homepage truth source. | `#/` routes to `home`, and AppShell is the top-level renderer for that branch. |
| Continue despite `init-session.sh` docs navigation sync error. | Session files were successfully created; error is unrelated to implementing the requested design. |
| Build the homepage in `design.pen` with custom frames/text instead of fully instantiating library components. | This keeps the output visually aligned with the existing UI while avoiding slot/instance overhead for a one-screen reconstruction. |
| Reuse the same session hash for the mobile-board follow-up request. | The user request is a direct refinement of the same homepage design task, so session continuity is required. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` reported `ERROR: docs.json missing navigation.languages[]`. | 1 | Kept generated session docs, logged issue, and proceeded with manual doc updates for this task. |
| First design batch used invalid text property `textColor` on text nodes. | 1 | Replaced text coloring with `fill` via follow-up updates and rechecked screenshot output. |

## Notes
- Re-read this plan before major layout decisions and before delivery.
- Keep updating findings after each discovery pair (2-Action Rule).
