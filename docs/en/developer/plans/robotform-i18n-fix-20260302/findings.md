# Findings & Decisions: Fix robot form i18n keys and prompt section copy
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. robotform-i18n-fix-20260302 */}

## Session Metadata
- **Session Hash:** robotform-i18n-fix-20260302
- **Created:** 2026-03-03

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Create a new git branch for the bugfix.
- Add missing i18n entry for `repos.robotForm.section.credentials` so the robot editor renders localized copy.
- Fix duplicated Chinese copy where the default prompt section title and field label both render "默认提示词模板".

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `frontend/src/pages/RepoDetailPage.tsx` uses `t('repos.robotForm.section.credentials')` as the title for the Credentials card in the robot editor modal.
- The i18n key `repos.robotForm.section.credentials` is missing in both `frontend/src/i18n/messages/en-US/repos.ts` and `frontend/src/i18n/messages/zh-CN/repos.ts`, causing the UI to fall back to the raw key / missing copy.
- In `zh-CN`, `repos.robotForm.section.prompt` currently equals `repos.robotForm.promptDefault` ("默认提示词模板"), so the Card title and the Form label show the same text twice.
- `en-US` already avoids this by using "Default prompt" (section) vs "Default prompt template" (field label).

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add `repos.robotForm.section.credentials` i18n in both locales | Ensures the Credentials section title is localized instead of rendering a missing key. |
| Change `zh-CN` `repos.robotForm.section.prompt` to "默认提示词" | Removes duplicated "默认提示词模板" while keeping the field label explicit. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| `init-session.sh` reports `docs.json missing navigation.languages[]` | Continue with plan files; update `docs/en/developer/plans/index.md` manually to keep navigation discoverable. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/src/pages/RepoDetailPage.tsx` (robot editor modal, section titles)
- `frontend/src/i18n/messages/en-US/repos.ts` (en-US i18n entries)
- `frontend/src/i18n/messages/zh-CN/repos.ts` (zh-CN i18n entries)
- `docs/en/developer/plans/index.md` (planning session index)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- N/A (no screenshots or external browser content used).
