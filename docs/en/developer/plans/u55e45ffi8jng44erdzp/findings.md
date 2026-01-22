# Findings & Decisions: repo-details-dashboard
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. u55e45ffi8jng44erdzp */}

## Session Metadata
- **Session Hash:** u55e45ffi8jng44erdzp
- **Created:** 2026-01-18

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Redesign the repository details page into a dashboard/board layout (bento-style), removing the tab switcher for: Basic, Branches, Credentials, Robots, Automation, Webhooks. {/* Capture user requirements for the dashboard refactor. u55e45ffi8jng44erdzp */}
- Preserve all existing functionality and actions previously available inside each tab. {/* Capture user requirements for the dashboard refactor. u55e45ffi8jng44erdzp */}
- Add useful statistics and charts to enrich the page (counts, trends, health indicators). {/* Capture user requirements for the dashboard refactor. u55e45ffi8jng44erdzp */}
- Ensure the new UI works with i18n, light/dark themes, and responsive layouts. {/* Capture platform constraints for the dashboard refactor. u55e45ffi8jng44erdzp */}
- Follow-up layout: switch to an explicit row-based layout (regions 1-5) and ensure each large region has a minimum height to avoid tiny empty cards. {/* Capture follow-up layout requirements for traceability. u55e45ffi8jng44erdzp */}
- Follow-up KPIs: the top overview should be task-based (repo task stats), not webhook-delivery-based. {/* Capture the KPI scale shift for traceability. u55e45ffi8jng44erdzp */}
- Follow-up scroll behavior: the top overview should live inside the scrollable page body (not fixed outside `.hc-page__body`). {/* Capture the scroll container constraint for traceability. u55e45ffi8jng44erdzp */}
- Follow-up layout tweak: split Robots into its own standalone row region and keep Automation as a separate trigger region. {/* Capture robots layout tweak for traceability. u55e45ffi8jng44erdzp */}
- Follow-up UI restore: keep the previous top KPI tile strip, but render it inside the page (not fixed). {/* Capture the KPI strip restore requirement for traceability. u55e45ffi8jng44erdzp */}

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- (pending) Identify current repo details page route/component and its tab composition. {/* Track discovery targets for repo details UI. u55e45ffi8jng44erdzp */}
- (pending) Inventory existing APIs/data used by each module to avoid regressions. {/* Track discovery targets for repo details UI. u55e45ffi8jng44erdzp */}
- (pending) Confirm existing chart libraries/components in the frontend (or add a minimal one). {/* Track discovery targets for repo details UI. u55e45ffi8jng44erdzp */}
- UI direction: "Bento Box Grid" is a good fit for dashboards (modular cards, asymmetric spans, clean hierarchy, subtle shadows, rounded corners). {/* Record UI/UX research summary for the new layout. u55e45ffi8jng44erdzp */}
- Visual guidance: combine a neutral base with a configurable accent color (keep good contrast in both light/dark themes). {/* Record UI/UX research summary for the new layout. u55e45ffi8jng44erdzp */}
- Existing implementation: `frontend/src/pages/RepoDetailPage.tsx` currently renders modules inside an AntD `Tabs` with keys `basic/branches/credentials/robots/automation/webhooks`. {/* Capture current implementation to guide the refactor. u55e45ffi8jng44erdzp */}
- Data availability: repo detail fetch (`fetchRepo`) returns `repo`, `robots`, `automationConfig`, webhook secret/path, and `repoScopedCredentials`; webhook delivery history is fetched separately via `listRepoWebhookDeliveries`. {/* Capture existing data sources for stats and charts. u55e45ffi8jng44erdzp */}
- Frontend dependencies: no charting library is currently installed; use AntD primitives (e.g. `Progress`) + lightweight SVG/CSS charts if needed. {/* Capture constraints for chart implementation. u55e45ffi8jng44erdzp */}
- Chart guidance: compact "performance vs target" visuals work well as gauges/progress bars (good for KPI cards). {/* Record chart UX guidance used for the dashboard stats. u55e45ffi8jng44erdzp */}
- Layout issue: using a row-based 12/12 grid with modules of very different heights can create large "holes" (empty vertical space) in the shorter column. {/* Capture the dashboard layout problem to be fixed. u55e45ffi8jng44erdzp */}
- Planned fix: switch to column-stacked layout and add pagination/height constraints for large lists (robots/deliveries/credentials/automation) to keep the board visually dense. {/* Capture the planned layout strategy. u55e45ffi8jng44erdzp */}

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Replace repo detail Tabs with a dashboard layout (summary strip + board-style cards) | The page is information-light per tab; a single dashboard reduces navigation friction while keeping all features visible. u55e45ffi8jng44erdzp |
| Implement charts via AntD `Progress` + lightweight CSS/SVG (no new deps) | No chart library is installed; this keeps bundle size stable and still delivers useful visual stats. u55e45ffi8jng44erdzp |
| Use `listRepoWebhookDeliveries` (limit 50) for webhook activity stats | The backend already exposes delivery history; we can derive distributions/trends client-side without new APIs. u55e45ffi8jng44erdzp |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| Automation panel table skeleton never disappeared when there were zero rules | Fixed `ScrollableTable` to treat omitted `loading` as `false` instead of defaulting to `true`. u55e45ffi8jng44erdzp |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/src/**` repo details page entrypoint (to be discovered). {/* Capture key file entrypoints for later reference. u55e45ffi8jng44erdzp */}
- `backend/src/**` repo stats endpoints (to be discovered if needed). {/* Capture backend touchpoints for later reference. u55e45ffi8jng44erdzp */}

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
