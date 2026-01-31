# Findings & Decisions: Multi-language dependency management implementation



# Findings & Decisions: Multi-language dependency management implementation
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. depmanimpl20260124 */}

## Session Metadata
- **Session Hash:** depmanimpl20260124
- **Created:** 2026-01-24

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Implement the full multi-language dependency management plan (runtime detection, config, install validation, execution, API, UI, DB).
- Support multi-subproject installs (e.g., backend + frontend directories) in a single repo.
- Ensure backend enforcement of runtime availability and command safety.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Agent execution lives in `backend/src/agent/agent.ts`, called by `backend/src/modules/tasks/task-runner.service.ts`.
- The agent clones/updates the repo and builds the prompt before running the model; dependency installs should run after checkout and before prompt generation.
- There is no existing system module; `AppModule` currently wires auth, tasks, tools, etc., so a new module/controller is needed for `/api/system/runtimes`.
- Prisma schema currently lacks `dependencyConfig` (RepoRobot) and `dependencyResult` (Task), so a schema update is required.
- Repo robot CRUD flow lives in `repositories.controller.ts` and `repo-robot.service.ts`; new `dependencyConfig` must be plumbed through DTOs and service normalization.
- The user panel is implemented in `frontend/src/components/UserPanelPopover.tsx`; adding an environment tab requires i18n updates and API wiring.
- Backend worker startup uses `WorkerModule` + `TaskRunner`, so runtime detection must run in `worker.ts` (not only HTTP bootstrap).
- Documentation entries for dependency docs/custom Docker images were still tagged with the older `depman20260124` hash and need traceability updates to `depmanimpl20260124`.
- Verified that remaining `depman20260124` references are limited to its own plan folder and changelog entry after updating docs/sidebars.
- Robot configuration UI and form logic live in `frontend/src/pages/RepoDetailPage.tsx`, including `RobotFormValues`, modal, and submit handlers.
- Task detail UI lives in `frontend/src/pages/TaskDetailPage.tsx`, so dependencyResult display should be added there.
- RepoDetailPage builds robot payloads in `handleSubmitRobot` and uses `buildRobotInitialValues`, so dependency overrides must be wired in both.
- TaskDetailPage sidebar renders metadata cards and git status; a dependency result card can be inserted in the sidebar stack.
- Robot editor UI is implemented as a modal Form in `RepoDetailPage.tsx`, so dependency override controls are added as a new card in that modal.
- Task detail tests live in `frontend/src/tests/taskDetailPage.test.tsx`, so dependency result rendering can be validated there.
- Task detail dependency panel supports filter/expand controls with `dependency-filter` test id and per-step cards using `data-testid` for UI tests.
- Backend controller needed explicit dependencyConfig casting to satisfy typed inputs; webhookTriggerOnly test required runtime/hookcode service mocks.
- Added dependency UI controls for keyword search, sorting, and grouping by workdir within TaskDetailPage.
- Extended TaskDetailPage tests to exercise dependency sorting, keyword filtering, and workdir grouping.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add `workdir` to runtime entries for multi-subproject installs | Multiple runtime entries per language avoids a new nested schema. |
| Persist install results in `tasks.dependency_result` | Keeps dependency telemetry separate from model output JSON. |
| Create a `SystemModule` exporting `RuntimeService` | Shared runtime detection for API and agent execution. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
-

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
- **Session Hash:** depmanimpl20260124
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
