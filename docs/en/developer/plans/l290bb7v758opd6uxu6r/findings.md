# Findings & Decisions: Stop auto HTML comments in changelog entries
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. l290bb7v758opd6uxu6r -->

## Session Metadata
- **Session Hash:** l290bb7v758opd6uxu6r
- **Created:** 2026-01-17

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
- Remove the auto-added HTML comment line like `<!-- Fix Vite ... <session-hash> -->` when appending changelog entries.
- Keep only the main one-line summary content in the changelog entry (plus the existing plan link / hash for traceability).
- Apply the fix at the automation layer (planning-with-files docs + `append-changelog.sh`) so future inserts never include the comment.

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
- `docs/en/change-log/0.0.0.md` currently contains extra HTML comments immediately before some bullet entries (example: `<!-- Fix Vite ... na4jf... -->`).
- `.codex/skills/planning-with-files/scripts/append-changelog.sh` currently appends a single markdown bullet and does not intentionally add those HTML comments.
- The extra HTML comments appear to be a traceability aid for Markdown edits, but they are redundant because the bullet already links to the plan by session hash.
- In zsh/bash, backticks inside double quotes still trigger command substitution; passing summaries like ``Fix Vite `/api` ...`` can cause shell errors unless you use stdin or escape properly.
- Removed existing redundant HTML comment lines from `docs/en/change-log/0.0.0.md` and documented the "no changelog HTML comments" rule in `AGENTS.md` + the skill doc.

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| Sanitize/normalize summary in `append-changelog.sh` (no newlines, strip HTML comment wrappers) | Prevent accidental multi-line/HTML-comment injections and enforce "summary only" output. |
| Treat changelog entries as self-traceable without extra HTML comments | The entry already includes the session hash + plan link, satisfying traceability while keeping the file clean. |
| Support reading summary from stdin in `append-changelog.sh` | Avoid shell expansion pitfalls when summaries contain code-like characters (backticks, `$`, etc.). |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
- `docs/en/change-log/0.0.0.md`
- `.codex/skills/planning-with-files/scripts/append-changelog.sh`
- `.codex/skills/planning-with-files/SKILL.md`
- `AGENTS.md`

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->
-

---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
