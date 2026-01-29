# Findings & Decisions: TaskGroup Dev preview plan evaluation



# Findings & Decisions: TaskGroup Dev preview plan evaluation
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. 3ldcl6h5d61xj2hsu6as */}

## Session Metadata
- **Session Hash:** 3ldcl6h5d61xj2hsu6as
- **Created:** 2026-01-29

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
-

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
-

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
- **Session Hash:** 3ldcl6h5d61xj2hsu6as
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
<!-- Record initial repo context and skill rules for traceability. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Noted repository root contains backend, frontend, docs, and planning skill assets; no existing session referenced in chat.
- Read planning-with-files skill: requires session folder updates and inline traceability comments with the plan path + hash.
<!-- Capture planning file templates observed for this session. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Planning templates include phase tracking, key questions, decisions, and error logs; updates must keep phase statuses in sync with progress.md.
<!-- Capture user clarifications on scope and constraints. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Deployment is single-instance; preview should support dependency installation and frameworks beyond Vite/Webpack; preview links can be shared externally.
<!-- Note existing .hookcode.yml parsing scope for dependency config. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- HookcodeConfigService currently validates version=1 and dependency.runtimes (language/version/install/workdir); no preview schema exists yet.
<!-- Summarize existing dependency types and installer references for reuse. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Dependency types are defined in backend/src/types/dependency.ts and dependency installs are implemented in backend/src/agent/dependencyInstaller.ts; hookcodeConfigService is the entry point for parsing .hookcode.yml.
<!-- Note dependency installer behaviors useful for preview dependency installs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- dependencyInstaller validates workdir confinement, enforces allowed install commands, and logs step results; it may be reusable for preview install preflight.
<!-- Record existing SSE infrastructure for log streaming. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- EventStreamService provides shared SSE publish/subscribe with topic filtering and heartbeat; tasks module also uses SSE for log streaming.
<!-- Capture task log SSE pattern for reuse in preview log streaming. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- tasks.controller implements SSE log streaming with init snapshot, keep-alive, and DB polling fallback; TaskLogStream is an in-memory pub/sub helper.
<!-- Note module wiring for adding new HTTP controllers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- AppModule imports TasksHttpModule; TasksHttpModule wires controllers (TasksController, TaskGroupsController, ChatController, DashboardController) and depends on TasksModule + RepositoriesModule.
<!-- Capture TasksModule exports and TaskGroupsController for preview endpoints placement. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- TasksModule provides TaskService, TaskLogStream, and HookcodeConfigService; TaskGroupsController currently handles list/get/tasks endpoints only.
<!-- Note auth helper for query-token SSE usage. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- AllowQueryToken decorator exists for SSE/EventSource to accept ?token=; it is used by tasks and events SSE endpoints.
<!-- Note auth guard/token extraction behavior for preview share links. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- AuthGuard enforces bearer/x-hookcode-token/query token when allowed; extractAuthToken only recognizes bearer/header/query tokens, so share-link auth may need a separate guard or token mode.
<!-- Capture workspace and repo slug helpers used for preview workspace resolution. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- buildTaskGroupWorkspaceDir and getRepoSlug (backend/src/agent/agent.ts) are the existing helpers for task-group workspaces; they require repo provider + payload to compute workspace paths.
<!-- Record frontend location for preview UI integration. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- TaskGroupChatPage is the main chat UI; it renders PageNav actions and a single scrollable chat body, making it the integration point for preview controls + iframe panel.
<!-- Note preview proxy auth and path rewrite approach for MVP. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview proxy routes use AllowQueryToken for iframe auth and rewrite HTML asset paths to keep `/preview/:group/:instance` working without HMR in Phase 1.
- Resuming session 3ldcl6h5d61xj2hsu6as with Phase 2 scope (WS proxy, multi-instance tabs, logs SSE, repo preview config).
- task_plan.md currently marks Phase 2 pending; needs update to in_progress when starting Phase 2 work.
- PreviewService currently manages process lifecycle/ports but has no log buffering or SSE output; PreviewProxy only handles HTTP (no WS upgrades).
- Backend bootstrap uses app.listen directly; WS upgrade handling exists in prismaStudioProxy with http.createServer + server.on('upgrade'), can mirror for preview WS support.
- Existing TaskLogStream + tasks controller SSE pattern can be reused to implement preview log streaming (in-memory publish/subscribe).
- tasks.controller logs SSE shows EventSource pattern (init/log events + keep-alive) suitable for preview log stream; repositories.controller currently lacks preview config endpoint.
- TaskGroupChatPage currently assumes single preview instance (previewState.instances[0]) and lacks tabs/logs UI; needs refactor for Phase 2 multi-instance + logs.
- TaskGroupPreviewController currently exposes start/stop/status only; PreviewInstanceSummary has no log fields or lastUpdated metadata.
- Preview panel UI in TaskGroupChatPage is a single header + iframe; needs tab bar, log button/modal, and per-instance status handling for Phase 2.
- Preview panel CSS defines header/body/iframe/placeholder only; needs new styles for instance tabs, log toolbar, and log modal layout.
- RepositoriesController constructor currently injects repository/robot/automation/webhook/user services; will need PreviewService injected to serve preview config endpoint.
- RepoDetailPage renders multiple cards (automation, webhook, robots, etc.); new preview config card can be added here with data from GET /repos/:id/preview/config.
- RepoDetailPage tests mock API via vi.mock; new repo preview config API needs to be added to mocks + assertions; i18n preview keys exist but need extensions for tabs/logs/share.
- HookcodeConfigService.parseConfig throws on invalid .hookcode.yml; repo preview config endpoint should catch and surface a config_invalid reason rather than 500.
- TaskGroupChatPage still uses previewState.instances[0] in toggle and UI; needs updates to use aggregated status + active instance selection.
- Updated preview UI references to use aggregate status and active instance; remaining updates needed mainly in CSS/i18n/tests and new modal styles.
- CSS theme defines --hc-accent-* variables for active states; preview tabs can use these for active styling.
- Theme defines --hc-accent-soft/--hc-accent-border for active-state styling; preview tabs can reuse these tokens for active/hover states.
- i18n uses {{var}} interpolation; new preview log/share labels should follow that format in en-US/zh-CN.
- RepoDetailPage builds section items array for dashboard regions; preview config card can be added as a new standalone region without touching summary strip keys if kept outside section() mapping.
- RepoDetailPage state hooks are near top; preview config state and fetch effect can be added alongside repo/webhook state without touching pagination logic.
- appShell and repoDetail tests mock ../api; new fetchRepoPreviewConfig export must be added to both mocks to avoid undefined calls.
- zh-CN repo detail strings use 'Webhook' labels; insert preview config strings after repos.detail.webhookTip for consistency.
- Backend unit tests use jest-style expect; new PreviewLogStream test can follow PreviewPortPool/EventStreamService patterns.
- PreviewWsProxyService depends on AuthUserLoader; TasksModule must import AuthModule to resolve auth dependency.
- Updated test mocks for fetchRepoPreviewConfig and verified new repos.preview i18n keys are in place.
- No existing resizable split-pane utility; TaskGroupChatPage uses flex layout and will need a custom drag divider for Phase 3.
- Reviewed planning-with-files skill; must update task_plan/findings/progress and keep inline comments with plan link + hash in every code change. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Noted preview types already include PreviewDiagnostics/diagnostics and config_invalid reason; Phase 3 implementation must align services/controllers/frontend with these types. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Reviewed PreviewService and TaskGroupChatPage; Phase 3 still needs idle timeout tracking, diagnostics propagation, hot reload, and draggable split in UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Located chat layout and preview panel markup; draggable split will wrap hc-chat-panel and preview panel with divider and width state. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Preview proxy and WS proxy currently lack access tracking; Phase 3 idle-timeout needs touch calls in both paths and in log SSE. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Current chat/preview layout uses flex with fixed 38% preview width in styles.css; need to refactor to draggable split with divider styles. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Backend package.json has no chokidar; config hot reload will require adding a dependency (likely chokidar) and ensuring no build-time network I/O. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- HookcodeConfigService only parses config; PreviewService will need its own config-path helper for hot reload watching. preview log stream currently simple, no idle tracking. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Docs + i18n preview copy need updates to mention idle timeout, hot reload, and diagnostics labels; en-US/zh-CN already contain preview keys to extend. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- getRepoSlug/buildTaskGroupWorkspaceDir require task payload with repo info; backend tests for PreviewService will need mock payload to compute workspace path. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- stopInstance currently resets status/message even on startup timeout; Phase 3 should preserve timeout status and support idle-stop messaging. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Found accent CSS variables (--hc-accent-*) available for styling new preview divider/diagnostics. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Located zh-CN preview i18n block near lines 930+ for adding diagnostics labels. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Jest unit tests live under backend/src/tests/unit; preview log stream test style can be reused for new PreviewService tests. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Reviewed progress/task plan to update Phase 3 completion and new test results for preview enhancements. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Checked for ws module; not installed, so Phase 4 WS proxy validation needs adding dev dependency or alternate handshake implementation. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- Located user-docs index and Docusaurus sidebars to add a new TaskGroup preview guide under docs/en/user-docs and update navigation. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- New requirement: preview panel should stay closed by default and only open after explicit user action post-start. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
- 2026-01-29: User wants Start Preview and Open Preview Panel merged into a single action that opens the panel when starting preview.
- 2026-01-29: Current UI uses separate preview panel toggle (previewPanelOpen) with i18n keys and tests/docs referencing "Open preview panel"; merging will require removing these references and auto-opening panel when preview starts.
