# Task Plan - Refactor TaskGroup Preview UI

Refactor the TaskGroup preview panel to be more modern, concise, and professional.

## Phases

### Phase 1: Planning & Design Refinement
- [x] Analyze current implementation in `TaskGroupChatPage.tsx` and `preview-shell.css`.
- [x] Define the new layout structure (compact header, integrated tabs).
- [x] Verify existing functionality (nav, address bar, tabs) to ensure no regressions.

### Phase 2: Component Refactoring (TSX)
- [x] Simplify `hc-preview-header` structure in `TaskGroupChatPage.tsx`.
- [x] Remove window dots.
- [x] Merge title/status/nav/address-bar into a more cohesive layout.
- [x] Refactor tabs to be more integrated.

### Phase 3: Style Modernization (CSS)
- [x] Update `preview-shell.css` with modern aesthetics.
- [x] Improve spacing and typography.
- [x] Refine the iframe container ("shell").
- [x] Add subtle transitions for better UX.

### Phase 4: Verification & Polishing
- [x] Test on different viewport sizes (desktop, side-by-side).
- [x] Verify multi-instance behavior.
- [x] Ensure dark/light theme compatibility.
- [x] Run existing tests to check for breakage.

## Key Questions
- Should the address bar stay as a full-width input, or can it be more compact?
- Do we need the "Preview" title if the status and URL are clear?
- Can we merge the instance tabs into the same row as the toolbar?

## Progress Tracking
- **Current Status**: Phase 1 in progress.
- **Active SESSION_HASH**: refactor-preview-ui-20260205