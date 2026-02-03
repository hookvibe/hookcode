# Findings: Responsive audit for mobile/tablet

## Summary
- User requests a full mobile (phone) + tablet responsive audit across the frontend and fixes for any layout issues.
- Must apply ui-ux-pro-max design guidance and improve product layout/visuals as part of the responsive fixes.
- Inline comment traceability is mandatory for every code change: include a one-sentence English comment with plan path and session hash.

## Evidence Log
- Repo contains separate frontend/backend directories and a design-system folder.
- Planning session initialized with hash `dhbg1plvf7lvamcpt546`.

## Frontend Scope Notes
- Frontend is a Vite + React app using Ant Design; responsive fixes will likely involve CSS overrides and component layout changes.
- Main pages live under `frontend/src/pages` with extensive CSS in `frontend/src/styles/*.css`.
- Existing test suite uses Vitest + Testing Library.

## UI/UX Pro Max Guidance
- Design system recommendation for HookCode leans toward a modern SaaS dashboard with glassmorphism cues, high-contrast dark palette, and technical typography (Fira Sans/Fira Code).
- Responsive checklist emphasizes 375px/768px/1024px/1440px breakpoints, no horizontal scroll, and 44px touch targets.

## Layout Entry Points
- `frontend/src/pages/AppShell.tsx` composes the main sidebar + content layout and likely drives responsive behavior.
- `frontend/src/styles/app-shell.css` currently only sets base shell height/background with no breakpoint logic.

## Early Responsive Risks
- `frontend/src/styles/page-layout.css` enforces a single-row header (`flex-wrap: nowrap`) which may truncate or overflow on small screens.
- Sidebar styles define fixed button heights and padding without explicit mobile overrides.

## Header/Nav Observations
- `frontend/src/styles/page-nav.css` hides meta content on <=768px but keeps action buttons in a single row; may still be tight on 375px when multiple actions exist.
- Sidebar section styles are fixed-width/padding without mobile-specific adjustments; collapsed behavior exists but no auto-collapse on small screens.

## Cards/Tables Notes
- Card grid uses breakpoints at 840px and 1200px; mobile has single-column layout already.
- Table wrapper styles focus on scroll containers but there is no explicit small-screen padding/stacking guidance.

## Detail Page Layout
- Repo detail uses full-width body and grid layouts; card summary uses auto-fit min 240px tiles.
- Task detail sidebar uses a sticky split layout with a clamp-based width (280px–420px) that may be too wide on small screens without a mobile override.

## Chat/Tasks Layout
- Chat layout uses side-by-side panels with fixed padding and no mobile breakpoint in `chat-layout.css`, which could force horizontal scroll on small screens.
- Tasks status strip uses responsive grid already; filters are flexible.

## Modal/Settings Layout
- Login layout is centered with width clamp; likely fine on mobile.
- Settings/user panel already has a mobile-specific layout under 768px.

## Follow-up Issues (2026-02-03)
- Mobile should fully hide the sidebar (no collapsed rail visible).
- Task group chat view is not scrolling on mobile; likely needs container height/overflow fixes.
- Start Preview action is not visible on mobile headers; needs icon-safe rendering and header layout tweaks.
