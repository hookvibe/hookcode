# Findings & Decisions: Optimize sidebar menu behavior
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. sidebar-menu-20260131 */}

## Session Metadata
- **Session Hash:** sidebar-menu-20260131
- **Created:** 2026-01-31

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Expanded sidebar: no scrollbar by default; show scrollbar only on hover.
- Expanded sidebar: place the "expand all task groups" control on the task group header area (not at the bottom).
- Collapsed sidebar: hide all task group icons except the "all task groups" icon.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Sidebar UI likely lives in frontend; need to locate component and CSS controlling scroll behavior and collapsed/expanded states.
- Sidebar layout is in `frontend/src/pages/AppShell.tsx`; `.hc-sider__scroll` wraps the sections, task group menu, and the task-group "view all" CTA rendered beneath the menu.
- Task group menu items are built in `AppShell.tsx` via `groupMenuItems` and always include an icon; the "view all" CTA is a separate button beneath the menu with an icon only when collapsed.
- `.hc-sider__scroll` in `frontend/src/styles.css` currently uses `overflow: auto`, so scrollbars show by default.
- The task-group "view all" button uses `.hc-sider-item--viewAll` styles (pill CTA with margin-top and dashed border) in `frontend/src/styles.css`.
- `frontend/src/tests/appShell.test.tsx` has a test that clicks a task group item by its label (expanded sidebar) but no existing coverage for collapsed task group visibility or the task-group "view all" placement.
- `.hc-sider__sectionLabel` and related sidebar layout styles live near the top of `frontend/src/styles.css`, so new header-row styles can be added nearby.
- i18n key `taskGroups.page.viewAll` resolves to "View all task groups" (en-US) and "查看全部任务组" (zh-CN), suitable for the view-all button aria-label.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- frontend source tree (components/layout/menu) needs inspection to locate sidebar/menu implementation.
- `frontend/src/pages/AppShell.tsx` contains the left sidebar menu and task group rendering.
- Root `package.json` runs full test suite via `pnpm test` (backend + frontend); frontend uses `node ./scripts/run-vitest.cjs`.

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-
