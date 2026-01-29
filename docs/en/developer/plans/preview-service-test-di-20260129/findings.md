# Findings & Decisions: Fix PreviewService DI in tests



# Findings & Decisions: Fix PreviewService DI in tests
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. preview-service-test-di-20260129 */}

## Session Metadata
- **Session Hash:** preview-service-test-di-20260129
- **Created:** 2026-01-29

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Fix pnpm test failures caused by RepositoriesController DI errors.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Failing unit tests instantiate RepositoriesController without providing PreviewService, causing Nest DI errors.
- Errors occur in repoArchivedReadOnlyApi and repoWebhookDeliveriesApi tests when creating testing module.
- RepositoriesController constructor now injects PreviewService from tasks module.
- repoArchivedReadOnlyApi unit test builds testing module without PreviewService provider.
- repoWebhookDeliveriesApi unit test also builds testing module without PreviewService provider.
- Integration tests construct RepositoriesController directly; constructor signature now includes PreviewService.
- Only unit tests failing are DI-based; other preview-related unit tests already stub PreviewService directly.
- Added PreviewService mock providers to the failing unit test modules; targeted tests now pass.

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
- backend/src/tests/unit/repoArchivedReadOnlyApi.test.ts
- backend/src/tests/unit/repoWebhookDeliveriesApi.test.ts
- backend/src/tests/integration/repoRobotDeleteGuard.test.ts
- backend/src/tests/integration/repoAutomationRuleRobotRequired.test.ts
- backend/src/tests/integration/repoRobotActivation.test.ts
- backend/src/tests/integration/repoRobotNoDefaultAutomationRules.test.ts
- backend/src/modules/repositories/repositories.controller.ts
- backend/src/modules/tasks/preview.service.ts
- backend/src/modules/tasks/tasks.module.ts
- backend/src/tests/unit/repoArchivedReadOnlyApi.test.ts

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
- **Session Hash:** preview-service-test-di-20260129
- **Created:** 2026-01-29

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
