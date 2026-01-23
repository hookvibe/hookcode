# Findings & Decisions: Persist sidebar state
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. l7pvyrepxb0mx2ipdh2y */}

## Session Metadata
- **Session Hash:** l7pvyrepxb0mx2ipdh2y
- **Created:** 2026-01-19

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Persist the left sidebar collapsed/hidden state across page refresh.
- When the sidebar is collapsed, remove the top "H" element and keep only the expand button.
- In collapsed sidebar mode, make the "Processing" icon spin only when there are processing tasks; keep it static when processing count is 0.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The frontend has its own guidelines: comments must be in English, support i18n, and avoid running `dev` unless needed.
- The sidebar is implemented in `frontend/src/pages/AppShell.tsx` using AntD `Layout.Sider`, with a brand row that renders `'H'` when collapsed and a button that toggles `siderCollapsed`.
- `siderCollapsed` is currently initialized with `useState(false)`, so a page refresh always expands the sidebar.
- Sidebar top row styles are defined in `frontend/src/styles.css` under `.hc-sider__brandRow` (flex, `justify-content: space-between`), so removing the brand text in collapsed mode likely needs a collapsed-specific alignment tweak.
- The app already persists UI preferences (theme/accent/locale) via `window.localStorage` with safe guards (`typeof window !== 'undefined'`), so sidebar collapsed state can follow the same pattern.
- `frontend/src/tests/appShell.test.tsx` already asserts the sidebar toggle button via aria-label ("Collapse sidebar"), so we can extend tests to cover localStorage-driven initial collapsed state and removal of the collapsed "H" label.
- `@ant-design/icons` applies `anticon-spin` automatically when `icon.name === 'loading'`, so `LoadingOutlined` spins by default even without the `spin` prop (need a targeted override for idle processing state).

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
- `frontend/src` (expected place for layout/sidebar implementation)
- `frontend/src/pages/AppShell.tsx` (sidebar layout and collapse toggle)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
