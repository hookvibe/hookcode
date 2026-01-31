# Findings & Decisions: Reorganize task-groups layout
<!-- Capture initial requirements and layout targets from user request. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->



# Findings & Decisions: Reorganize task-groups layout
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. taskgroups-reorg-20260131 */}

## Session Metadata
- **Session Hash:** taskgroups-reorg-20260131
- **Created:** 2026-01-31

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Change task-group workspace layout to `task-groups/<taskgroup-id>/`.
- Inside the taskgroup folder, create `.codex/skills/` as a placeholder directory.
- Clone the repo into `<taskgroup-id>/<repo-name>/` instead of encoding repo info in the folder name.
- Ensure `codex-output.txt` is placed in the taskgroup folder after execution.
- Ensure `codex-schema.json` and `AGENTS.md` placeholders live in the taskgroup folder.
- Ensure codex/claude/gemini commands run with working directory set to the taskgroup folder.
- Update user-facing docs to describe the new workspace layout.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Current workspace example provided: `backend/src/agent/build/task-groups/3fe82a09-74af-4ec2-a634-e804d4cf8e06__github__hookvibe__hookcode-test`.
- Target structure: `task-groups/<taskgroup-id>/.codex/skills/`, `<repo-name>/`, `codex-output.txt`, `codex-schema.json`, `AGENTS.md`.
- `buildTaskGroupWorkspaceDir` in `backend/src/agent/agent.ts` currently returns `task-groups/<taskgroupId>__<provider>__<slug>`.
- Agent uses `repoDir = buildTaskGroupWorkspaceDir(...)` for git clone/pull and checkout inside `backend/src/agent/agent.ts` (task runner).
- Codex/Claude/Gemini execution paths in `backend/src/agent/agent.ts` pass `repoDir` into provider runners today (current working directory assumed to be repo root).
- `backend/src/modelProviders/codex.ts` sets Codex SDK `workingDirectory` to `repoDir` and adds `${repoDir}/.git` for workspace-write runs.
- `backend/src/modelProviders/claudeCode.ts` sets Claude SDK `cwd` to `repoDir` and uses `additionalDirectories` with `${repoDir}/.git` for workspace-write runs.
- `backend/src/modelProviders/geminiCli.ts` spawns the CLI with `cwd: repoDir`.
- `backend/src/utils/taskOutputPath.ts` places provider output files under `~/.hookcode/task-outputs/<taskId>` (or env override) and guards against repo-local output roots.
- No current backend code references `codex-schema.json` or `AGENTS.md` for task-group workspaces (only examples/docs mention them).
- `backend/src/modules/tasks/preview.service.ts` resolves workspace paths via `buildTaskGroupWorkspaceDir` and falls back by prefix `${taskGroupId}__${provider}__`.
- `backend/src/modules/tasks/task-git-push.service.ts` uses `buildTaskGroupWorkspaceDir` as the repo directory for git push commands.
- `HookcodeConfigService.parseConfig` reads `.hookcode.yml` from the provided workspace dir (expected to be repo root).
- `getRepoSlug` returns repo identifiers like `org__repo` (slashes replaced with `__`), which currently feed workspace naming.
- Unit tests under `backend/src/tests/unit/*` assert the old `taskgroupId__provider__slug` workspace layout (taskGroupWorkspace + PreviewService).
- `backend/src/tests/unit/codexExec.test.ts` reads `codex-output.txt` from `repoDir`, so output path changes will require test updates.
- Codex runner writes output to `params.outputLastMessageFile` if absolute; otherwise uses `path.join(repoDir, outputLastMessageFile)`.
- Claude Code and Gemini CLI runners also resolve `outputLastMessageFile` relative to `repoDir` when given a non-absolute path (per `rg` in modelProviders).
- User docs mention task workspaces in `docs/en/user-docs/preview.md` and `.hookcode.yml` docs; they will need updates to describe the new layout.
- `docs/en/user-docs/preview.md` troubleshooting references "Workspace missing" without defining the workspace layout.
- `docs/en/user-docs/config/hookcode-yml.md` refers to the "task workspace" for dependency installs.
- Backend guidelines require running `pnpm build` after backend changes and keeping frontend API consumers aligned; new backend user-facing output must support i18n.
- Backend `tsconfig.json` does not enable `noUnusedParameters`, so optional signature params are safe to keep.
- Provider modules now accept a `workspaceDir` override to run commands from the task-group root while keeping repo paths available.
- Changelog updates are recorded in `docs/en/change-log/0.0.0.md` under the "Changes" list.
- `git diff --stat` shows unrelated edits in `backend/package.json` and `pnpm-lock.yaml` (likely pre-existing or tool-generated) that were not part of the workspace layout changes.

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
- `backend/src/agent/build/task-groups/` (current workspace root)
- `backend/src/agent/agent.ts` (workspace builder + task runner)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
