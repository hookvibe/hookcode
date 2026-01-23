# Findings & Decisions: Repo activity list UI redesign

{/* Record UI requirements and code touchpoints for repo provider activity redesign. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc */}




## Session Metadata
- **Session Hash:** 4wrx55jmsm8z5fuqlfdc
- **Created:** 2026-01-22

## Requirements


- Redesign each activity item as a single-row list entry with a compact task-group indicator aligned to the far right.
- Do not render full task-group lists inline; provide a separate navigation action to open task-group detail pages.
- Center pagination controls and switch to icon-only prev/next buttons; ensure the layout does not overflow on narrow widths.
- Add visible spacing (or vertical dividers) between Commits/Merges/Issues columns so the three regions are not visually cramped.
- Increase provider activity page size so each column shows more items and reduces blank space inside the dashboard slot.
- Make commits/merges/issues pagination independent: changing one page must not refresh the other columns or show skeletons for them.

## Research Findings


- UI is implemented in `frontend/src/components/repos/RepoDetailProviderActivityRow.tsx` with 3 columns (commits/merges/issues) and a shared `activityLoading` flag.
- Pagination currently triggers `fetchRepoProviderActivity` and replaces the whole `activity` object, which causes all columns to re-render and show skeletons.
- Task-group navigation uses hash routes via `buildTaskGroupHash()` (`#/task-groups/:id`).

## Technical Decisions


| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered


| Issue | Resolution |
|-------|------------|
|       |            |

## Resources


-

## Visual/Browser Findings



-

---

*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
