# Task Plan: 修复表格滚动条样式




## Session Metadata

- **Session Hash:** qh23ler2y5yeesg6hqel
- **Created:** 2026-01-22

## Goal

Make RepoDetail tables look like Ant Design docs (subtle scrollbars + no always-visible vertical scrollbar + compact table density) by fixing our table scrollbar CSS targeting and defaulting shared tables to `size="small"` while keeping theme compatibility.

## Current Phase

Phase 1

## Phases


### Phase 1: Requirements & Discovery

- [x] Understand user intent (RepoDetail tables scrollbars look too thick)
- [x] Identify constraints and requirements (keep scrolling behavior + theme support)
- [x] Document findings in findings.md
- **Status:** complete


### Phase 2: Planning & Structure

- [x] Define technical approach
- [ ] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation

- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification

- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery

- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions

1. Which global CSS is overriding the browser/OS scrollbar (and why does it look heavier than antd.com)?
2. Should we restore the default OS scrollbar behavior (preferred) or just shrink the custom scrollbar styling?
3. How do we keep dark/light theme scrollbars readable without forcing a custom WebKit scrollbar?

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Remove global `::-webkit-scrollbar*` styling and rely on `color-scheme` + Firefox `scrollbar-color` | Styling WebKit scrollbars globally makes scrollbars look heavy (and can disable macOS overlay scrollbars), which diverges from antd.com. |
| Default `ScrollableTable` to `size="small"` | The Ant Design size demo favors compact tables; defaulting the wrapper keeps RepoDetail tables visually lighter without touching every call site. |
| Add a table-scoped thin scrollbar style for `.table-wrapper .ant-table-container` | OS-native scrollbars can still look thick on some platforms (e.g. Windows), so we style only table overflow containers to match the subtle scrollbar look on antd.com. |
| Apply scrollbar styling to `.ant-table-content/.ant-table-body` (not `.ant-table-container`) | AntD uses `.ant-table-content` (and `.ant-table-body` for fixed header) as the real scroll container; styling the outer container can create a nested scroll layer and an always-visible vertical scrollbar gutter. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes

- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
