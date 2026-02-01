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
<!-- Capture preview highlight bridge requirements. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Provide a backend API to send highlight commands and a shared bridge script (stored in repo root `shared/`) that users can import manually to enable cross-origin DOM highlighting.
<!-- Capture request to package highlight operations into a reusable skill. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Create a dedicated skill that documents preview highlight operations and ships JS request scripts with env loading.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
<!-- Note current plan status and scope shift for preview access. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- task_plan.md shows Phase 22 complete; new work must add a follow-up phase for local direct-port previews and production subdomain routing.
<!-- Capture current preview iframe URL composition for the new routing plan. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- TaskGroupChatPage currently builds preview iframe URLs from API_BASE_URL + preview path + token, so local direct-port and subdomain routing need a new URL builder.
<!-- Record preview summary fields that will drive new URL routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- PreviewInstanceSummary currently returns port + path (path = /preview/:taskGroup/:instance/); new direct-port + subdomain routing must either add a publicUrl field or re-derive from port and config.
<!-- Capture new preview host mode environment configuration for routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Subdomain preview routing relies on HOOKCODE_PREVIEW_HOST_MODE + HOOKCODE_PREVIEW_BASE_DOMAIN (optional scheme override) to build public URLs.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
<!-- Record preview routing strategy for local vs production deployments. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
| Use direct localhost ports for local previews and subdomain routing in production | Avoid path rewrite failures locally while enabling shareable, wildcard-hosted previews in production |
<!-- Record the preview highlight bridge integration approach. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
| Require manual bridge script integration + postMessage handshake for DOM highlights | Cross-origin iframes cannot be manipulated directly, so a user-provided bridge is the safest stable path |

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
- 2026-01-29: Preview panel toggle button (Eye icons) and i18n keys were the only UI affordance to open the panel; merging requires removing the toggle and letting preview activity drive visibility.
- 2026-01-29: Preview panel visibility now tracks preview state; clearing previewState on taskGroup change prevents stale panel carryover without a separate open button.
- Confirmed planning-with-files skill requirements and session folder already exists for hash 3ldcl6h5d61xj2hsu6as; templates were not overwritten.
- New request: preview fails for a task group even though repo has .hookcode.yml; need to inspect task-group workspace and preview config detection logic.
- Provided workspace path to inspect: backend/src/agent/build/task-groups/53a3147d-d36b-4edd-a868-7221201c7c25__github__hookvibe__hookcode-test.
- Task-group workspace contains .hookcode.yml with preview.instances[0] (pnpm dev, port 5173, readyPattern "Local:" — fixed port now disallowed), plus project files (package.json, vite.config.ts).
- PreviewService.getStatus resolves preview config via resolvePreviewConfig; it returns available=false when hookcode config parse fails or preview instances missing.
- Repo preview config detection uses the latest task group workspace and HookcodeConfigService.parseConfig; parsing errors return reason=config_invalid, missing preview returns config_missing.
- resolvePreviewConfig always resolves workspace via latest task in the group; if hookcodeConfigService.parseConfig throws, status reason=config_invalid; if preview.instances missing, reason=config_missing.
- resolveWorkspaceDir derives repoSlug from latest task payload + provider; workspace path is buildTaskGroupWorkspaceDir({taskGroupId, taskId, provider, repoSlug}) and must exist or preview returns workspace_missing.
- buildTaskGroupWorkspaceDir uses TASK_GROUP_WORKSPACE_ROOT + `${taskGroupId}__${provider}__${repoSlug}`; repoSlug is derived from task payload.
- getRepoSlug for GitHub uses payload.repository.full_name with '/' replaced by '__', so repo hookvibe/hookcode-test becomes hookvibe__hookcode-test in workspace path.
- TASK_GROUP_WORKSPACE_ROOT is backend/src/agent/build/task-groups, matching the provided workspace location.
- HookcodeConfigService validates preview.instances with required name/command/workdir; .hookcode.yml in workspace matches schema so parseConfig should succeed.
- startPreviewInternal stops existing preview, runs installDependenciesIfNeeded, then spawns each preview instance with env PORT/HOST=127.0.0.1; command supports {{PORT}} replacement.
- Dependency installs run via dependencyInstaller before preview start when dependency config exists; failures surface as dependency_failed.
<!-- Clarify preview port contract: system-assigned only, no fixed ports in config. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview instances must use system-assigned ports exposed via `PORT`/`{{PORT}}`; `.hookcode.yml` must not set fixed ports.
- Preview services allocate from the port pool and rely on commands honoring `PORT` to avoid readiness stalls.
- TaskGroupChatPage shows "Preview unavailable" when previewStatus.available=false; refreshPreviewStatus sets available=false on 404/409 responses (config_missing/config_invalid/workspace_missing).
- TaskGroupPreviewController status uses PreviewService.getStatus; resolveWorkspaceDir derives workspace from latest task payload and will fail (workspace_missing/missing_task) if the latest task lacks repo payload, even if an older task created the workspace.
- BUILD_ROOT is derived from __dirname in agent.ts, so running API/worker from different build outputs (dist vs src) can point to different task-group workspace roots.
- Preview status returns workspace_missing when TASK_GROUP_WORKSPACE_ROOT differs from the directory where the worker cloned the repo; a robust fix should resolve build root from repo paths or env instead of __dirname only.
- User observed preview status response `{error:"Task group workspace missing", code:"workspace_missing"}` for group 53a3147d-d36b-4edd-a868-7221201c7c25, confirming backend couldn't resolve workspace path at runtime.
<!-- Capture preview startup stall root cause for fixed-port dev servers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview instances that ignore the assigned `PORT` (e.g., defaulting to 5173) can hang in "starting" until timeout; configs must use placeholders instead of fixed ports.
<!-- Record env placeholder rule for preview configs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview instance env overrides are supported; any env value that includes a port must use the `{{PORT}}` placeholder (no hardcoded ports).
<!-- Note skill updates for .hookcode.yml generation rules. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- hookcode-yml-generator skill now mirrors the no-fixed-port rule and injects PORT placeholders in commands/env.
<!-- Capture iframe auth fix for preview assets. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview iframes now persist query tokens into a scoped cookie so asset requests can authenticate without headers.
<!-- Capture preview base href duplication root cause. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview HTML rewriting was double-prefixing base href because it derived the prefix from req.baseUrl; it now derives from originalUrl to preserve `/api/preview/...` once.
<!-- Capture asset path rewrite requirement for preview proxying. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview asset requests must strip the full `/api/preview/{group}/{instance}` prefix before proxying, otherwise Vite returns 404 and the iframe stays blank.
<!-- Capture JS/CSS rewrite requirement for Vite dev assets. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Vite dev JS/CSS responses include absolute paths (`/src/...`, `/@react-refresh`); these must be rewritten to include the preview prefix.
<!-- Capture double-prefix pitfall for preview path rewrites. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview path rewrite must avoid re-prefixing URLs already starting with `/api/preview/...`, otherwise assets 404 with duplicated prefixes.
<!-- Capture base href double-prefix issue. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Injected base href can be double-prefixed unless attribute rewriting skips already-prefixed paths.

- 2026-01-30: Confirmed session folder exists for hash 3ldcl6h5d61xj2hsu6as; will reuse it for the preview install-path investigation.

- 2026-01-30: Reviewed session plan/progress; Phase 8 previously addressed workspace resolution and build root alignment for preview failures. New issue likely in dependency install step after repo clone.

- 2026-01-30: dependencyInstaller resolves workdir relative to workspaceDir and rejects absolute paths; it runs commands with cwd = resolved workdir. Suspect workspaceDir passed in is wrong or not the repo root for preview tasks.

- 2026-01-30: preview.service resolves workspaceDir via buildTaskGroupWorkspaceDir and passes it directly to installDependencies; installDependencies uses workspaceDir as repo root for workdir resolution. Path issue may stem from resolveWorkspaceDir/build root.

- 2026-01-30: buildTaskGroupWorkspaceDir uses TASK_GROUP_WORKSPACE_ROOT plus `${taskGroupId}__${provider}__${repoSlug}`; if TASK_GROUP_WORKSPACE_ROOT differs between worker and preview service, install cwd could point at wrong tree (e.g., src vs dist build paths).

- 2026-01-30: The task-group workspace exists and contains .hookcode.yml; dependency config runs `pnpm install --frozen-lockfile` with no workdir, so install should execute at repo root (workspaceDir). Issue likely not a missing file; path resolution or command execution context may still be wrong.

- 2026-01-30: Searched build workspace for dependency install logs; none found in files under backend/src/agent/build (no log artifacts to inspect locally).

- 2026-01-30: getRepoSlug replaces "/" with "__"; workspace path looks correct for hookvibe/hookcode-test. No obvious slug/path bug found in helper.

- 2026-01-30: pnpm is available on PATH in this environment (/opt/homebrew/bin/pnpm, v9.6.0), so install failures are unlikely due to missing pnpm binary.

- 2026-01-30: preview.service no longer needs shDoubleQuote after switching dependency installs to use explicit cwd (import cleanup required).

- 2026-01-30: Backend test script uses Jest; ran new runCommandCapture test successfully to validate cwd handling.

- 2026-01-30: Changelog already contains two 3ldcl6h5d61xj2hsu6as entries; will append a new bullet for the dependency install cwd fix.

- 2026-01-30: Manual `pnpm install --frozen-lockfile` succeeds inside the reported task-group workspace, so the path itself is valid in this environment.

- 2026-01-30: TaskGroupChatPage currently uses only a logs Modal; start/stop preview is a header button with no modal or reinstall control. A new UI affordance is needed to add a manual reinstall action.

- 2026-01-30: Backend preview controller exposes start/stop/status/logs only; preview service always runs installDependenciesIfNeeded during startPreview. There is no standalone dependency reinstall endpoint yet.

- 2026-01-31: Added preview dependency reinstall endpoint + start modal; backend previewService and frontend taskGroupChatPage tests pass after adjusting modal queries.

- 2026-01-31: Confirmed task-group workspace has no node_modules; running pnpm install inside it outputs "Scope: all 4 workspace projects", meaning pnpm is climbing to the parent hookcode monorepo workspace. This causes installs to run in the parent workspace instead of the cloned repo. pnpm has --ignore-workspace to prevent parent workspace detection.

- 2026-01-31: User reports preview remains unavailable after dependency install; need to refresh preview status after install and avoid disabling start button when unavailable.
