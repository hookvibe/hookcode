# Findings & Decisions: Migrate docs.json to Docusaurus

{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. dsim8xybp9oa18nz1gfq */}

## Session Metadata
- **Session Hash:** dsim8xybp9oa18nz1gfq
- **Created:** 2026-01-22

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Delete `docs/docs.json` (Mintlify config) from the repo.
- Replace Mintlify docs tooling with a Docusaurus docs site.
- Keep existing docs content under `docs/en/**` readable and navigable.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `docs/docs.json` was a Mintlify docs configuration file and `package.json#dev:doc` used `npx mint dev`; after migration it is replaced by a Docusaurus site under `docs/`.
- Existing documentation lives under `docs/en/**` (User Docs, API Reference, Developer Docs, Change Log).
- The planning-with-files skill scripts were updated to skip `docs.json` sync when `docs/docs.json` is absent (Docusaurus does not require explicit nav sync).
- `pnpm --filter hookcode-docs build` succeeds after the migration.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Host the Docusaurus site in `docs/` as a workspace package | Keeps docs-related tooling co-located with content and matches the existing `cd docs` workflow |
| Point the docs plugin path at `docs/en` (not a nested `docs/docs`) | Avoids moving existing content and keeps URLs predictable |
| Keep docs served under `/docs/*` (Docusaurus default) | Avoids needing a special `homePageId` and keeps a clear separation between site home and docs |
| Exclude `**/AGENTS.md` from docs build | Prevents internal agent instructions from becoming public docs routes |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `docs/docusaurus.config.ts`
- `docs/sidebars.ts`
- `docs/en/user-docs/index.md`
- `.codex/skills/planning-with-files/scripts/init-session.sh`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-
