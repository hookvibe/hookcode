# Findings & Decisions: Prevent fork bypass + ensure upstream PR targeting
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. 24yz61mdik7tqdgaa152 -->

## Session Metadata
- **Session Hash:** 24yz61mdik7tqdgaa152
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
- Add a fork fallback when upstream credentials cannot push but the repository is public/open-source.
- Guardrails: fetch/pull must be from upstream; PR/MR must target upstream (avoid creating PR/MR against the fork by mistake).
- Clearly display when a task is using fork vs direct clone.
- Detect and reuse an existing fork (avoid re-fork errors).
- Fork must be performed via tokens (repo credential + PAT), not via interactive login.

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
- The clone/update logic lives in `backend/src/agent/agent.ts` (local `cloneRepo()` inside `callAgent()`), and currently only configures `origin` based on the webhook clone URL (no fork support).
- Git provider wrappers exist at `backend/src/modules/git-providers/github.service.ts` and `backend/src/modules/git-providers/gitlab.service.ts`, but they currently do not implement fork/PR creation APIs.
- The agent already supports redacting tokens in logs and passes `GIT_TERMINAL_PROMPT=0` for git commands.
- The "robot activation test" stores repo-role info (`repoTokenRepoRole` + details) which can be used as a hint for upstream push eligibility.
- Chat/manual tasks also generate webhook-like payloads containing `repository.clone_url` / `project.git_http_url`, so fork logic should support both webhook and chat payload shapes.

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
| Use `origin` fetch=upstream + pushURL=fork (when needed) | Ensures pulls always track upstream while pushes go to fork without changing common commands (`git push origin`). |
| Install a `.git/hooks/pre-push` guard that validates expected remotes | Prevents accidental pushes to the wrong repo and provides clear error messages when remotes drift. |
| Persist `result.repoWorkflow` and show it in Task Detail UI | Makes fork vs direct workflow explicit to reduce confusion and debugging time. |

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
- `backend/src/agent/agent.ts`
- `backend/src/services/repoRobotAccess.ts`
- `backend/src/modules/git-providers/github.service.ts`
- `backend/src/modules/git-providers/gitlab.service.ts`

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
