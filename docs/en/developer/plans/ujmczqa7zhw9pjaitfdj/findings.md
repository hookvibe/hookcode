# Findings & Decisions: robot write permission change tracking mechanism design



# Findings & Decisions: robot write permission change tracking mechanism design
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. ujmczqa7zhw9pjaitfdj */}

## Session Metadata
- **Session Hash:** ujmczqa7zhw9pjaitfdj
- **Created:** 2026-01-23

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Provide a mechanism to detect code changes and branch changes when a robot has write permission.
- Track whether commits were created and whether a push to remote succeeded.
- Surface status in the frontend, including the case where local changes exist but are not pushed.
- Work within the existing workflow that currently pulls code before running codex commands.
- Move the git status panel to the bottom of each task message in the group view and make it full-width.
- Provide an actionable push flow from the git status panel when a fork has unpushed commits.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Git operations (fetch/checkout/pull) appear in backend/src/agent/agent.ts, indicating a centralized execution workflow for repo sync.
- Frontend task pages already reference permissions (e.g., task.permissions?.canManage), suggesting existing permission-aware UI hooks.
- backend/src/agent/agent.ts manages repo cloning/sync and installs a pre-push guard, plus sets origin push URL based on upstream/fork decisions.
- No direct git status/commit/push commands are present in agent.ts beyond remote configuration and pre-push guard installation.
- TaskResult (backend/src/types/task.ts) currently stores logs, token usage, output, providerCommentUrl, and repoWorkflow; a new git status payload could live here.
- TaskRunner patches TaskResult with logs/output after agent completes; extending the agent return and patch payload is the likely integration point.
- TaskDetailPage already renders TaskResult.repoWorkflow in the sidebar; a similar section can display git change/push status.
- TaskGroupChatPage renders TaskConversationItem for each task, making it a reusable place to surface per-task git status in the group view.
- frontend/src/api.ts TaskResult is a loose interface; adding typed fields there will help reuse in TaskDetail + TaskGroup.
- backend/src/utils/gitWorkflow.ts already normalizes remote URLs, useful for safe link generation.
- frontend/src/i18n/messages/en-US.ts contains task field labels and is the right place to add new git status strings (also mirror zh-CN).
- TaskConversationItem shows the per-task card in TaskGroup chat and is a suitable host for a reusable git status panel.
- TaskDetailPage sidebar can host a new git status panel card without disrupting existing Descriptions layout.
- Git status UI should derive commit/branch links from repoWorkflow + gitStatus pushWebUrl for fork-aware navigation.
- TaskRunner unit tests assert patchResult payloads and require updates when new gitStatus fields are included.
- TaskGroupChatPage fetches full task details for terminal tasks, so gitStatus can be rendered once tasks finish.
- Change log entries live in docs/en/change-log/0.0.0.md with plan links; added this session's entry there.
- The new UX must make the git status panel span the message width and sit at the bottom of the task group item.
- TaskConversationItem currently renders TaskGitStatusPanel between the task card and the thought-chain card, wrapped in `hc-chat-item__assistant`, which explains the current narrow width.
- Chat item layout uses `.hc-chat-item__assistant` flex containers, while card widths are constrained by `width: min(820px, 86vw)` in `.hc-chat-task-card` and `.hc-chat-logs-card` within `frontend/src/styles.css`.
- TaskGitStatusPanel currently renders status tags and details only; no push action is wired yet, and it uses the default `hc-card` styling without explicit width constraints.
- Tasks controller only exposes list/stats/logs/retry endpoints; there is no existing API to trigger a git push from the UI.
- Repo workspace directories are created in `backend/src/agent/agent.ts` under `BUILD_ROOT` during task execution, but no reusable service currently exposes a push operation for those directories.
- Agent builds `repoDir` as `${BUILD_ROOT}/${provider}__${repoSlug}__${refSlug}` using `getRepoSlug()` and the resolved checkout ref, so any push endpoint must recreate this path deterministically or store it at runtime.
- Frontend API client exposes task retry/delete/log endpoints but has no helper for a git push action yet.
- TasksModule already instantiates AgentService (which sets agent service singletons), so a push endpoint can reuse exported helpers from `backend/src/agent/agent.ts` without adding new providers.
- TasksController sanitizes task results via `sanitizeTaskForViewer` and returns task payloads from new endpoints in the same way as `GET /tasks/:id`.
- TaskGitStatusPanel currently has no action controls; adding a push button will require extending this component and the frontend API client.
- TaskDetailPage renders TaskGitStatusPanel in the sidebar; any new push action should work for both task detail and task group chat views.
- Backend unit tests use Jest with module mocking (e.g., `jest.mock('../../agent/agent')`), which we can follow for the new push service tests.
- Frontend task API helpers live near `retryTask`, so the push helper can be added alongside it for consistency.
- Git status uses `git rev-parse HEAD` for the final snapshot; a mismatch with a log-reported commit implies the workspace head changed after the log line or the log refers to a different task/workspace.
- The task workspace is shared per repo+branch; a later task can change HEAD, so a push action should verify the current HEAD matches the task's captured head before pushing.
- Local workspace `github__hookvibe__hookcode-test__main` shows `main...origin/main [ahead 1]` with HEAD at `cf71cc3` and previous commit `391e342`, indicating the mismatch is due to stale task snapshots rather than missing local commits.
- In that workspace, `origin/main` resolves to `391e342` while `HEAD` resolves to `cf71cc3`, confirming the local commit is ahead of upstream but not yet reflected in the tracked fetch remote.
- The git status UI should label successful pushes with the target (fork/upstream) and show a warning when push state indicates head or remote mismatch.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Store git change/push tracking in TaskResult.gitStatus | Keeps per-task status close to logs/output and works without schema changes. |
| Use git ls-remote against the push URL to detect fork push success | Upstream tracking branches stay tied to fetch remotes, so ls-remote validates fork pushes correctly. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| Empty `git ls-remote` output was treated as push error | Treat empty output as "not pushed yet" (no error) so UI shows unpushed. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md

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
- **Session Hash:** ujmczqa7zhw9pjaitfdj
- **Created:** 2026-01-23

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
