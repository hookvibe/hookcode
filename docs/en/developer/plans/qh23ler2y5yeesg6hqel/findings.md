# Findings & Decisions: 修复表格滚动条样式




## Session Metadata
- **Session Hash:** qh23ler2y5yeesg6hqel
- **Created:** 2026-01-22

## Requirements


- RepoDetail tables that overflow horizontally should have subtle, thin scrollbars (like the Ant Design docs examples).
- RepoDetail tables should not show an always-visible vertical scrollbar when the table is not vertically scrollable (pagination is preferred).
- RepoDetail tables should default to a compact density (`size="small"`) so the table does not look visually "heavy".
- Keep existing horizontal scroll behavior for tables (especially on narrow/mobile screens).
- Keep light/dark theme compatibility and avoid introducing new UI regressions.

## Research Findings


- Global scrollbar styling exists in `frontend/src/styles.css` and applies to all elements via `*::-webkit-scrollbar*` with a fixed 10px thickness and a visible track, making scrollbars look heavy compared to antd.com.
- RepoDetail tables are wrapped by `ScrollableTable`, and `.table-wrapper .ant-table-container { overflow-x: auto; }` intentionally enables horizontal scrolling, so the global scrollbar CSS is very visible in RepoDetail.
- `ScrollableTable` used Ant Design Table defaults (size "middle"), which makes row padding larger than the compact tables shown in the Ant Design docs size demo.
- After removing the global WebKit scrollbar overrides, some environments may still show thick OS-native scrollbars (e.g. Windows or "always show scrollbars"), so the visual impact can be minimal without a table-scoped override.
- AntD Table's real scroll containers are `.ant-table-content` (normal) and `.ant-table-body` (fixed header); applying `overflow`/scrollbar styling on `.ant-table-container` can create a nested scroll layer and surface an always-visible vertical scrollbar gutter.

## Technical Decisions


| Decision | Rationale |
|----------|-----------|
| Remove global `*::-webkit-scrollbar*` rules, keep `color-scheme` + Firefox `scrollbar-color` | Restores OS-native scrollbar rendering (esp. macOS overlay scrollbars) and aligns the look with Ant Design docs while still supporting themed UIs. |
| Default `ScrollableTable` to `size="small"` (overrideable per call site) | Matches the compact table density users expect from the Ant Design docs and reduces the perceived "thickness" of tables in RepoDetail. |
| Add a table-scoped thin scrollbar style for `.table-wrapper .ant-table-container` | Ensures the table overflow scrollbar is consistently subtle across platforms while avoiding global scrollbar hacks. |
| Move scrollbar styling to `.table-wrapper .ant-table-content/.ant-table-body` | Fixes the "always visible vertical scrollbar" caused by styling the wrong outer container and ensures the scrollbar styling actually applies to the element that scrolls. |

## Issues Encountered


| Issue | Resolution |
|-------|------------|
| User reported "no visible change" after the first attempt | Added a table-scoped thin scrollbar override to make the effect obvious across OS/browser combinations. |

## Resources


- Ant Design Table (size/scroll demos): https://ant.design/components/table-cn#table-demo-size

## Visual/Browser Findings



- Not reproduced in a live browser session inside the repo; the root cause is identified via code inspection (global scrollbar CSS + table overflow container).

---

*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
