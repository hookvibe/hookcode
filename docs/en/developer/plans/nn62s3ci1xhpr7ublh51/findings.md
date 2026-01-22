# Findings & Decisions: RepoTaskVolumeTrend → ECharts
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. nn62s3ci1xhpr7ublh51 */}

## Session Metadata
- **Session Hash:** nn62s3ci1xhpr7ublh51
- **Created:** 2026-01-20

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Replace `frontend/src/components/repos/RepoTaskVolumeTrend.tsx` chart rendering with ECharts.
- Keep existing controls (preset buttons + custom date range picker) and data semantics (UTC day aggregation).
- Keep responsive behavior (auto resize to container) and existing loading/error UI.
- Add/update tests to cover the new integration (mock ECharts if needed).

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Current implementation renders a custom SVG line/area chart and measures container width with `ResizeObserver`.
- Data is fetched via `fetchTaskVolumeByDay({ repoId, startDay, endDay })` and missing days are filled on the frontend via `enumerateDaysUtcInclusive(...)`.
- Tick labels and tooltips use `formatDayLabel(locale, day)` for locale-aware formatting, while `day` strings remain `YYYY-MM-DD` (UTC day).
- Existing styling for the chart lives in `frontend/src/styles.css` under `.hc-repo-activity__trend*` and currently targets the SVG elements; the container already defines a 150px height, border, and background that can be reused for ECharts.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Use modular ECharts (`echarts/core` + selected charts/components/renderers) | Keeps integration explicit and avoids adding an extra React wrapper dependency. |
| Derive chart colors from CSS variables (`--accent`, `--hc-*`) | Ensures the chart follows light/dark theme + user-configurable accent color. |
| Keep the chart container mounted and overlay `Skeleton` during the initial fetch | Prevents ECharts from binding to a DOM node that later gets unmounted during loading. |
| Mock ECharts modules in Vitest setup | JSDOM lacks Canvas APIs required by ECharts/zrender; mocking keeps tests deterministic. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| Vite failed to resolve `echarts/core` | Added `echarts` dependency to `frontend/package.json` via pnpm workspace install. |
| Vitest/JSDOM crashed on `HTMLCanvasElement.getContext` when ECharts initialized | Mocked ECharts modules in `frontend/src/tests/setup.ts` and added a focused component test. |
| ECharts x-axis min/max date labels are clipped by 1 character at the chart edges | Configure `axisLabel.alignMinLabel/alignMaxLabel` (and showMin/showMax) so edge labels anchor inward instead of centering beyond the canvas bounds. |
{/* Capture the root cause and fix for clipped min/max axis labels. nn62s3ci1xhpr7ublh51 */}

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/src/components/repos/RepoTaskVolumeTrend.tsx`
- `frontend/package.json`
- `frontend/src/styles.css`
- `frontend/src/tests/setup.ts`
- `frontend/src/tests/repoTaskVolumeTrend.test.tsx`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
