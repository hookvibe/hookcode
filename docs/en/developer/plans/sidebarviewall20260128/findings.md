# Findings: Optimize sidebar separators and view-all button

## Summary
- User wants two horizontal dividers in the left sidebar: between the task group and task area, and between the task area and repo area, visible in both expanded and collapsed states.
- User wants View All button redesigned; the active highlight should indicate the current task view state instead of highlighting the View All button itself.

## Open Questions
- Sidebar component location and how sections are structured.
- How active view state is stored and which UI element maps to it.
- Existing style tokens or divider components to reuse.

## Discovery Notes
- Sidebar and View All logic are in `frontend/src/pages/AppShell.tsx`, with styles in `frontend/src/styles.css`.
- View All button uses `.hc-sider-item--more` and currently gets `.hc-sider-item--active` via `viewAllActive` in AppShell.
- Tests covering View All and sidebar behavior exist in `frontend/src/tests/appShell.test.tsx`.

## UI Structure Notes
- Sidebar layout and section labels live in `frontend/src/pages/AppShell.tsx` within the `.hc-sider__scroll` container.
- Sidebar visual styles (items, headers, and section labels) are defined in `frontend/src/styles.css` under `.hc-sider*` selectors.

## Tooling Notes
- Frontend tests run via `pnpm --filter hookcode-frontend test` (Vitest).
