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
Deliver TaskGroup Dev preview Phase 2 with WS proxy (HMR), multi-instance tabs, live logs, and repository preview config detection.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
<!-- Track the active build phase for preview feature delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
<!-- Set current phase to Phase 2 for active work. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
Phase 7 (complete)

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

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
<!-- Update key questions for Phase 1 delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
1. Where should preview orchestration live (module/service) to reuse TaskGroup context and auth?
2. How should .hookcode.yml preview config be validated while remaining backward compatible?
3. What minimum proxy routing rules are required for iframe preview without HMR?
4. How will dependency install preflight be triggered in Phase 1 without blocking the worker?

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

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
