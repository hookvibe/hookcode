# Task Plan: Preview layout + composer actions + preview indicator + auto-stop

{/* Track code changes with this session hash for traceability. 1vm5eh8mg4zuc2m3wiy8 */}

## Session Metadata
- **Session Hash:** 1vm5eh8mg4zuc2m3wiy8
- **Created:** 2026-02-04

## Goal
Improve TaskGroup preview UX by (1) defaulting preview to half-width on wide screens and a compact top panel on mobile with open-in-new-page actions, (2) adding a composer actions popover with preview start + auto-start after dependency installs, and (3) showing preview-active indicators + hidden 30-minute auto-stop/port reclaim.

## Current Phase
Phase 5 (complete)

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach (preview layout, composer actions, preview visibility timer)
- [x] Identify target files/components
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Implement preview panel layout (wide half-width + mobile top panel with open actions)
- [x] Add composer actions popover with preview start + auto-start after dependency installs
- [x] Add preview-active indicator in modern sidebar task group list
- [x] Validate preview hidden reporting and 30-minute auto-stop/port reclaim wiring
- [x] Reposition preview instance tabs beneath the address bar and refine toolbar layout
- [x] Add/adjust tests
- [x] Ensure preview-active dots refresh immediately after preview start/stop
- [x] Start hidden-timeout tracking when previews run without UI visibility reports
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify requirements
- [x] Document tests in progress.md
- [x] Fix issues
- **Status:** complete

### Phase 5: Delivery
- [x] Review outputs
- [x] Update changelog entry
- [x] Deliver to user
- **Status:** complete

## Key Questions
1. Where does the left sidebar render task group entries, and how can we attach preview status?
2. What frontend layout controls the preview panel width and mobile positioning?
3. What backend service manages preview lifecycle and port allocation, and how to stop + release ports?
4. How do we detect “preview hidden for 30 minutes” (frontend visibility signal vs backend polling)?
5. Where should the composer actions popover live, and how does it trigger preview start + dependency reinstall?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Decorate task-group list/sidebar payloads with `previewActive` from PreviewService. | Avoid extra frontend polling while keeping sidebar dots accurate. |
| Render the preview-active dot inside modern sidebar task group rows. | Keeps the indicator visible without reverting the refreshed sidebar layout. |
| Add `/task-groups/:id/preview/visibility` endpoint + frontend visibility reporting. | Backend owns the 30-minute hidden timeout and port cleanup. |
| Use responsive CSS + stored width ratio for preview panel sizing. | Keep wide screens at 50% while allowing mobile to float a compact top panel. |
| Reuse the preview start modal for composer actions and auto-start after dependency installs. | Keeps preview controls consistent and reduces duplicate logic. |
| Place preview instance tabs under the address bar and co-locate toolbar actions. | Makes the header more compact and keeps navigation controls grouped. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| rg: unrecognized flag --accent | 1 | Re-ran with `rg -n -- \"--accent\"` to avoid flag parsing. |
