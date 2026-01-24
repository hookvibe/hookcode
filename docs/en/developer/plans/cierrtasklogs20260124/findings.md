# Findings & Decisions: Diagnose CI failures: node-pty build + TasksController DI



# Findings & Decisions: Diagnose CI failures: node-pty build + TasksController DI
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. cierrtasklogs20260124 */}
<!-- Track CI fix discoveries for this session. docs/en/developer/plans/cierrtasklogs20260124/task_plan.md cierrtasklogs20260124 -->

## Session Metadata
- **Session Hash:** cierrtasklogs20260124
- **Created:** 2026-01-24

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- 排查 CI 失败原因并给出修复方向（node-pty 构建失败 + TasksController 单测 DI 失败）。

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- CI 日志显示 node-pty 需要重建，node-gyp 报错 “not found: make”，说明 runner 缺少 make/build-essential。
- 单测失败源于 TasksController 构造函数新增 TaskGitPushService 依赖，但 taskLogsFeatureToggle.test.ts 仅提供了 TaskService/TaskLogStream/TaskRunner。
- tasksVolumeByDayController.test.ts 直接 new TasksController 仅传 3 个参数，导致 TS2554（缺少 TaskGitPushService）。
- CI workflow 在 .github/workflows/ci.yml 中未安装构建工具，pnpm install 时 node-pty 重建会因为缺少 make 失败。
- 目前仅有 taskLogsFeatureToggle.test.ts 与 tasksVolumeByDayController.test.ts 直接依赖 TasksController。
- 当前工作区存在其他未关联变更（agent/task-git-push 等文件），此次修复需避免触碰这些改动。
- 变更日志位于 docs/en/change-log/0.0.0.md，需追加本次修复条目并链接到计划文件。

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| 在单测中 stub TaskGitPushService | 保持单测隔离，不引入真实模块依赖 |
| CI 需要 make/build-essential 或避免触发 node-pty 本地编译 | 解决 node-pty 重建失败 |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| node-pty node-gyp rebuild 失败 | 需要 CI 提供 make/build-essential 或避免重建 |
| TasksController DI 缺失 TaskGitPushService | 在相关单测中注入 stub provider |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- backend/src/tests/unit/taskLogsFeatureToggle.test.ts
- backend/src/tests/unit/tasksVolumeByDayController.test.ts
- backend/src/modules/tasks/tasks.controller.ts
- .github/workflows/ci.yml

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
