# Findings & Decisions: Handle gemini/claude agent files and templates



# Findings & Decisions: Handle gemini/claude agent files and templates
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. gemini-claude-agents-20260205 */}

## Session Metadata
- **Session Hash:** gemini-claude-agents-20260205
- **Created:** 2026-02-05

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Add task-group logic so Codex writes AGENTS.md, Claude Code writes CLAUDE.md, and Gemini writes GEMINI.md.
- Copy `.claude` and `.gemini` directories (from `example/.codex/` sibling folders) into task execution workspace alongside `.codex`.
- Ensure Claude Code runs with the task-group (task id) root as its working directory instead of the repo subfolder.
- Surface task-group cwd explicitly in Claude prompt/log output so the model does not infer cwd from repo-only tool results.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Task-group AGENTS content is generated in `backend/src/agent/agent.ts` via `buildTaskGroupAgentsContent`, and written to `AGENTS.md`.
- Unit coverage exists in `backend/src/tests/unit/taskGroupWorkspace.test.ts` for AGENTS content generation.
- Task-group layout uses `ensureTaskGroupCodexDir` to copy `backend/src/agent/example/.codex` into the task-group root, and `ensureTaskGroupLayout` writes `AGENTS.md` plus syncs `.env` into `.codex/skills`.
- Provider execution (`runCodexExecWithSdk`, `runClaudeCodeExecWithSdk`, `runGeminiCliExecWithCli`) runs with `workspaceDir` set to the task-group root, so CLAUDE.md/GEMINI.md should live there.
- Example templates exist at `backend/src/agent/example/.claude` and `.gemini`, each with a `skills/` subfolder.
- User docs describe the task-group workspace layout in `docs/en/user-docs/preview.md`, currently listing only `AGENTS.md`.
- Claude Code execution uses `workspaceDir ?? repoDir` as `cwd`, but tool access checks currently lock to `repoDir` in `backend/src/modelProviders/claudeCode.ts`.
- Claude Code tool results can still come from the repo folder, so a prompt prefix is needed to prevent cwd misinterpretation.

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
- `backend/src/agent/agent.ts`
- `backend/src/tests/unit/taskGroupWorkspace.test.ts`
- `backend/src/agent/example/.claude`
- `backend/src/agent/example/.gemini`
- `docs/en/user-docs/preview.md`
- `backend/src/modelProviders/claudeCode.ts`
- `backend/src/agent/promptBuilder.ts`

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
- **Session Hash:** gemini-claude-agents-20260205
- **Created:** 2026-02-05

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
