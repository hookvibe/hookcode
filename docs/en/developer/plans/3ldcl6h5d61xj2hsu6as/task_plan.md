# Task Plan: TaskGroup Dev preview Phase 2 build
<!-- Update plan title to reflect Phase 2 scope. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. 3ldcl6h5d61xj2hsu6as */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** 3ldcl6h5d61xj2hsu6as
- **Created:** 2026-01-29

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
<!-- Define the implementation goal for TaskGroup preview delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
<!-- Refresh goal statement for Phase 2 scope. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
Diagnose and fix TaskGroup preview failures for repos that contain .hookcode.yml, starting from the reported task-group workspace.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
<!-- Track the active build phase for preview feature delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
<!-- Set current phase to Phase 2 for active work. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
<!-- Mark Phase 12 as complete after preview availability refresh fix. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
<!-- Move active phase to Phase 23 for local port + subdomain routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
Phase 23 (complete)

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1 (MVP)
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
<!-- Align Phase 1 checklist with the user-provided MVP scope. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] 配置文件解析和验证
- [ ] 端口池管理和分配
- [ ] 进程启动、监控、停止
- [ ] 基础代理网关（不含 WebSocket）
- [ ] 前端启停按钮和状态展示
- [ ] 单实例 iframe 预览
- [x] 配置文件解析和验证
- [x] 端口池管理和分配
- [x] 进程启动、监控、停止
- [x] 基础代理网关（不含 WebSocket）
- [x] 前端启停按钮和状态展示
- [x] 单实例 iframe 预览
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
<!-- Align Phase 2 checklist with the user-provided scope. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] WebSocket 代理支持（HMR）
- [ ] 多实例 Tab 切换
- [ ] 实时日志流查看
- [ ] 仓库配置检测 API
- [x] WebSocket 代理支持（HMR）
- [x] 多实例 Tab 切换
- [x] 实时日志流查看
- [x] 仓库配置检测 API
- **Status:** complete

### Phase 3
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
<!-- Align Phase 3 checklist with the user-provided scope. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] 可拖拽分栏布局
- [ ] 空闲超时自动停止
- [ ] 启动失败详细诊断
- [ ] 配置热重载
- [x] 可拖拽分栏布局
- [x] 空闲超时自动停止
- [x] 启动失败详细诊断
- [x] 配置热重载
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
<!-- Restore Phase 4 for end-to-end verification. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [x] Run backend/FE tests relevant to preview
- [x] Validate HMR/WS proxy with a sample project
- [x] Document test results in progress.md
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
<!-- Define delivery steps for implementation delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [x] Summarize changes and architecture decisions
- [x] Provide migration/ops notes for running previews
- [x] Update changelog with session hash and plan link
<!-- Reset delivery checklist for Phase 2 rollout. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [x] Summarize changes and architecture decisions (Phase 2)
- [x] Provide migration/ops notes for running previews (Phase 2)
- [x] Update changelog with session hash and plan link (Phase 2)
- **Status:** complete

### Phase 6: Preview Panel Gating
<!-- Track follow-up UX requirements for preview panel default state. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Do not show preview panel by default
- [ ] Add explicit open/close control after start preview
- [ ] Update docs/tests for the new preview panel flow
- [x] Do not show preview panel by default
- [x] Add explicit open/close control after start preview
- [x] Update docs/tests for the new preview panel flow
- **Status:** complete

### Phase 7: Merge Preview Start + Panel Open
<!-- Track the merged preview start/open control updates. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Merge preview start and panel open into a single action
- [ ] Update tests, i18n, and docs for the merged flow
- [x] Merge preview start and panel open into a single action
- [x] Update tests, i18n, and docs for the merged flow
- **Status:** complete

### Phase 8: Debug Preview Failure
<!-- Reopen Phase 8 to address workspace path resolution mismatches. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [x] Inspect task-group workspace and preview config detection output
- [x] Trace backend preview start/status flow for the task group
- [x] Verify frontend gating/error handling for preview availability
- [x] Identify root cause and implement fix (tests + docs if needed)
- **Status:** complete

### Phase 9: Dependency Install Path Check
<!-- Track dependency install path diagnostics for task-group workspaces. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Verify workspace path usage during dependency installs (agent + preview)
- [ ] Harden command execution to use explicit cwd and clearer path diagnostics
- [ ] Add or update tests/notes for the dependency install path behavior
- [x] Verify workspace path usage during dependency installs (agent + preview)
- [x] Harden command execution to use explicit cwd and clearer path diagnostics
- [x] Add or update tests/notes for the dependency install path behavior
- **Status:** complete

### Phase 10: Preview Manual Reinstall
<!-- Add manual dependency reinstall action in the preview start flow. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Add backend endpoint to trigger preview dependency install without starting preview
- [ ] Add frontend UI control in the start preview dialog and wire API call
- [ ] Add tests + i18n strings for the reinstall action
- [x] Add backend endpoint to trigger preview dependency install without starting preview
- [x] Add frontend UI control in the start preview dialog and wire API call
- [x] Add tests + i18n strings for the reinstall action
- **Status:** complete

### Phase 11: pnpm Workspace Escape Guard
<!-- Prevent pnpm installs from climbing into the parent HookCode workspace. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Detect parent pnpm-workspace.yaml and append --ignore-workspace for pnpm installs
- [ ] Add tests to cover pnpm workspace ignore logic
- [ ] Validate install path behavior for nested repo checkouts
- [x] Detect parent pnpm-workspace.yaml and append --ignore-workspace for pnpm installs
- [x] Add tests to cover pnpm workspace ignore logic
- [x] Validate install path behavior for nested repo checkouts
- **Status:** complete

### Phase 12: Preview Availability Refresh
<!-- Ensure preview status refreshes after dependency installs and avoid overzealous disable states. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Refresh preview status after manual dependency install
- [ ] Loosen preview start button disabling to allow retries
- [ ] Update tests and docs if needed
- [x] Refresh preview status after manual dependency install
- [x] Loosen preview start button disabling to allow retries
- [x] Update tests and docs if needed
- **Status:** complete

### Phase 13: Honor Preview Config Ports
<!-- Fix preview startup stalls by using configured instance ports. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Allocate configured preview ports instead of always using the port pool range
- [ ] Add tests for specific port reservation behavior
- [x] Allocate configured preview ports instead of always using the port pool range
- [x] Add tests for specific port reservation behavior
- **Status:** complete

### Phase 14: Remove Fixed Preview Ports
<!-- Enforce system-assigned preview ports and reject port fields in config. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Remove preview port fields from schema/types/docs/examples
- [ ] Reject .hookcode.yml preview instances that specify a fixed port
- [ ] Update tests and changelog entries
- [x] Remove preview port fields from schema/types/docs/examples
- [x] Reject .hookcode.yml preview instances that specify a fixed port
- [x] Update tests and changelog entries
- **Status:** complete

### Phase 15: Preview Env Port Placeholders
<!-- Support preview env overrides with PORT placeholders and reject fixed ports. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Add preview env support in schema/types/service with PORT placeholder substitution
- [ ] Validate env port values to prevent hardcoded ports
- [ ] Update docs/examples and add tests
- [x] Add preview env support in schema/types/service with PORT placeholder substitution
- [x] Validate env port values to prevent hardcoded ports
- [x] Update docs/examples and add tests
- **Status:** complete

### Phase 16: Update hookcode-yml-generator Skill
<!-- Align hookcode-yml-generator templates with new preview PORT placeholder rules. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Update skill workflow to remove fixed preview ports
- [ ] Update reference logic + template to use {{PORT}} placeholders and env rules
- [x] Update skill workflow to remove fixed preview ports
- [x] Update reference logic + template to use {{PORT}} placeholders and env rules
- **Status:** complete

### Phase 17: Preview Proxy Token Cookie
<!-- Keep preview iframes authenticated by persisting query tokens into cookies. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Set preview auth cookie from query token on proxy responses
- [ ] Accept preview auth cookie in token extraction
- [ ] Add tests and update changelog
- [x] Set preview auth cookie from query token on proxy responses
- [x] Accept preview auth cookie in token extraction
- [x] Add tests and update changelog
- **Status:** complete

### Phase 18: Preview HTML Base Prefix Fix
<!-- Fix preview HTML base href duplication that breaks iframe asset loading. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Derive preview prefix from originalUrl to include /api and avoid duplication
- [ ] Add tests for prefix derivation
- [x] Derive preview prefix from originalUrl to include /api and avoid duplication
- [x] Add tests for prefix derivation
- **Status:** complete

### Phase 19: Preview Asset Path Rewrite
<!-- Ensure asset requests strip the /api/preview prefix when proxying to the dev server. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Strip preview prefix from asset paths when proxying to upstream
- [ ] Add tests for prefix stripping logic
- [x] Strip preview prefix from asset paths when proxying to upstream
- [x] Add tests for prefix stripping logic
- **Status:** complete

### Phase 20: Preview Text Response Rewrites
<!-- Rewrite JS/CSS inline paths so Vite dev assets load inside preview iframes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Rewrite JS/CSS responses to prefix absolute module paths
- [ ] Extend preview proxy tests for inline module rewrites
- [x] Rewrite JS/CSS responses to prefix absolute module paths
- [x] Extend preview proxy tests for inline module rewrites
- **Status:** complete

### Phase 21: Prevent Double Preview Prefixes
<!-- Avoid re-prefixing paths already rewritten with /api/preview. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Skip rewrite when paths already start with the preview prefix
- [ ] Add tests for double-prefix prevention
- [x] Skip rewrite when paths already start with the preview prefix
- [x] Add tests for double-prefix prevention
- **Status:** complete

### Phase 22: Prevent Base Href Double Prefix
<!-- Avoid double-prefixing the injected base href in preview HTML. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [ ] Skip attribute rewriting when base href already includes the preview prefix
- [ ] Add tests for base href double-prefix prevention
- [x] Skip attribute rewriting when base href already includes the preview prefix
- [x] Add tests for base href double-prefix prevention
- **Status:** complete

### Phase 23: Direct Port (Local) + Subdomain (Prod) Preview Routing
<!-- Implement local direct-port previews and production subdomain routing to replace path-based proxy. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- [x] Add backend config/env to describe preview host mode and base domain
- [x] Extend preview status summary to include derived public URL (or fields needed for URL builder)
- [x] Update frontend preview iframe/link builder to use local direct port or subdomain mode
- [x] Update tests for URL building and preview summary
- [x] Update user-docs (preview + hookcode-yml) to document local vs prod access and wildcard DNS
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
<!-- Update key questions for Phase 1 delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
1. Where should preview orchestration live (module/service) to reuse TaskGroup context and auth?
2. How should .hookcode.yml preview config be validated while remaining backward compatible?
3. What minimum proxy routing rules are required for iframe preview without HMR?
4. How will dependency install preflight be triggered in Phase 1 without blocking the worker?
5. Why is preview unavailable for the reported task-group workspace despite .hookcode.yml being present?
<!-- Add dependency install path question for Phase 9. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
6. Is dependency install executing in the expected task-group workspace path for agent + preview flows?
<!-- Add manual reinstall UX question for Phase 10. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
7. How should the manual dependency reinstall action surface in the preview start UX without disrupting existing flows?
<!-- Track pnpm workspace root escape issue. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
8. How do we stop pnpm from treating the parent HookCode monorepo as the workspace when running installs in cloned repos?
<!-- Track preview availability refresh after dependency installs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
9. How should preview status refresh after installs so users can retry without reloading?
<!-- Track preview startup stall root cause. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
10. How do we enforce system-assigned preview ports and require PORT placeholders in preview commands?
11. How should preview env overrides enforce `{{PORT}}` placeholders instead of fixed ports?
12. How should the hookcode-yml-generator skill reflect the no-fixed-port preview rules?
13. How should preview iframes authenticate asset requests without headers?
14. How do we avoid double-injecting preview prefixes in rewritten HTML?
15. How should preview proxy strip /api/preview prefixes for asset requests?
16. How should preview proxies rewrite JS/CSS absolute paths for Vite dev servers?
17. How do we avoid double-prefixing already rewritten preview paths?
18. How do we prevent the injected base href from being prefixed twice?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
<!-- Record scope decisions now that implementation is approved. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
| Proceed with implementation starting Phase 1 | User authorized building and confirmed constraints |
| Assume single-instance deployment | User confirmed single-instance runtime |
| Proxy preview HTML rewrites absolute paths to include `/preview/...` prefix | Keeps iframe assets working without HMR in Phase 1 |
| Attach a preview WS upgrade proxy in bootstrap | Enables HMR/WebSocket previews without rewriting controller routes |
| Use in-memory PreviewLogStream for preview logs | Matches single-instance deployment and keeps SSE simple |
<!-- Record preview routing decision for local direct ports and production subdomains. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
| Use direct localhost ports and subdomain routing for previews | Avoid proxy rewrite failures locally while enabling production-ready wildcard URLs |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| Vitest could not find test files when using `frontend/src/...` path | 1 | Re-ran vitest with `src/tests/...` relative path |
| Syntax error from invalid regex `/\\/$/` in TaskGroupChatPage.tsx | 2 | Fixed regex to `/\/$/` and re-ran tests |
| `rg` rejected `--hc-` as invalid flag | 1 | Re-ran with `rg -- \"--hc-\"` |
| RepoDetailPage vitest run timed out (default 10s) | 1 | Re-ran with higher timeout |
| Preview config test failed due to duplicate "frontend" matches | 2 | Switched to `findAllByText` |
| apply_patch failed due to mismatched context on repoDetailPage test edit | 1 | Reloaded file and re-applied patch |
| PreviewService test failed with TS2322 ChildProcess type mismatch | 1 | Switched preview spawn stdin to pipe and closed it |
| pnpm add -D ws timed out | 1 | Re-ran with longer timeout |
| previewWsProxy test failed due to missing ws types | 1 | Added @types/ws and typed WebSocket handlers |
| TaskGroupChatPage tests failed with previewAggregateStatus TDZ error | 1 | Moved auto-hide effect below previewAggregateStatus definition |
| TaskGroupChatPage tests couldn't find Open preview panel button | 1 | Switched test matcher to regex to include icon label |
| TaskGroupChatPage test failed due to duplicate \"Start preview\" matches | 1 | Scoped modal title query using selector |
| TaskGroupChatPage test failed to match reinstall button name | 2 | Relaxed matcher to regex to include icon label |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
