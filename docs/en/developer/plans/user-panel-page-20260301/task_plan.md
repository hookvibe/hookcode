# Task Plan: Convert user panel popover to standalone page
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. user-panel-page-20260301 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** user-panel-page-20260301
- **Created:** 2026-03-01

## Goal

Convert the `UserPanelPopover` component from a modal-based popup into a standalone page with its own sidebar navigation, matching the `RepoDetailPage` + `RepoDetailSidebar` pattern.

## Current Phase

Phase 4: Verification (complete)

## Phases

### Phase 1: Discovery & Analysis
- [x] Analyze UserPanelPopover structure (Modal + 5 tabs)
- [x] Analyze RepoDetailSidebar pattern
- [x] Understand AppShell routing
- **Status:** complete

### Phase 2: Planning
- [x] Design route scheme (#/settings/:tab)
- [x] Plan component structure
- **Status:** complete

### Phase 3: Implementation
- [x] Add routes to router.ts
- [x] Create UserSettingsSidebar component
- [x] Create UserSettingsPage component (refactor from UserPanelPopover)
- [x] Update AppShell to route settings page + hide global sidebar
- [x] Convert trigger button to navigation
- [x] Add CSS styles
- **Status:** complete

### Phase 4: Verification
- [x] Build check (vite build: 5.18s, no errors)
- [x] TypeScript check (no new errors; pre-existing sidebarConstants issues only)
- **Status:** complete

## Key Questions

1. Keep sub-modals (profile edit, token edit) as modals? → Yes, small functional dialogs
2. Keep logout in sidebar? → Yes, at bottom like current layout
3. Route scheme? → `#/settings` + `#/settings/:tab` (account/credentials/tools/environment/settings)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Route: `#/settings/:tab` | Matches repo detail pattern `#/repos/:id/:tab` |
| Own sidebar, hide global | Same pattern as repo detail page |
| Keep sub-modals as modals | Small editing dialogs, not navigation targets |
| Refactor in-place | UserPanelPopover is 1720 lines; extract content into page |
