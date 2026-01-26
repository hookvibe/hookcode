# Findings & Decisions: Multi-language dependency management docs



# Findings & Decisions: Multi-language dependency management docs
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. depman20260124 */}

## Session Metadata
- **Session Hash:** depman20260124
- **Created:** 2026-01-24

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Add complete configuration documentation for Docker customization examples supporting additional runtimes.
- Add complete `.hookcode.yml` dependency configuration guidance with failure modes and install commands.
- Place the documentation under `docs/en/user/user-docs`.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The provided design plan defines runtime detection, dependency validation, and security constraints that must be reflected in user docs.
- The repo uses `docs/en/user-docs` (not `docs/en/user/user-docs`) for user documentation.
- User docs include `docs/en/user-docs/config` for configuration topics, likely the right place for `.hookcode.yml` guidance.
- `docs/en/user-docs/environment.md` covers runtime configuration, while repository configuration lives in `docs/en/user-docs/config/repositories.md`.
- No existing user-docs mention `.hookcode.yml`, so new documentation is needed.
- Docusaurus navigation is defined in `docs/sidebars.ts`, so new user docs must be added there.
- Docker Compose builds backend/worker from `backend/Dockerfile`, so runtime extensions should target that image or a custom Dockerfile used by those services.
- There are no existing references to `hookcode:latest` or `Dockerfile.custom`, so new docs must define the convention explicitly.
- The changelog format in `docs/en/change-log/0.0.0.md` uses single-line bullets with plan links, without extra HTML comments.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Keep scope to user-facing docs for this iteration | The request explicitly focuses on documentation; code changes can follow after doc review. |
| Add `docs/en/user-docs/custom-dockerfile.md` and `docs/en/user-docs/config/hookcode-yml.md` | Matches existing user-docs structure and separates Docker setup from repo configuration. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- docs/en/user/user-docs (target location for new documentation)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## Session Metadata
- **Session Hash:** depman20260124
- **Created:** 2026-01-24

## Requirements


-

## Research Findings


-

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
