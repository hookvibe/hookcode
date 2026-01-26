# Findings & Decisions: Swagger启动方式



# Findings & Decisions: Swagger启动方式
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. p1qnl1d63n6c7wiob2wt */}

## Session Metadata
- **Session Hash:** p1qnl1d63n6c7wiob2wt
- **Created:** 2026-01-26

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- 说明当前项目如何启动 Swagger，并给出访问方式（如地址/路径）。
- 采用中文回复。

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
<!-- Capture Swagger startup and auth discoveries for this session. docs/en/developer/plans/p1qnl1d63n6c7wiob2wt/task_plan.md p1qnl1d63n6c7wiob2wt -->
- 项目要求使用 planning-with-files 工作流并记录计划与发现。
- Swagger 由后端 Admin Tools 启动：`startAdminTools` 在启用后创建 Swagger 应用并监听 `cfg.host:cfg.swaggerPort`，日志打印 `swagger listening on http://<host>:<port>`。
- 存在独立的 Admin Tools 启动入口：`backend/src/adminTools/standalone.ts`，加载 `.env` 后调用 `startAdminTools` 并保持进程运行。
- 后端脚本 `dev:tools` 指向 `src/adminTools/standalone.ts`，用于单独启动 Admin Tools（含 Swagger UI）。
- Swagger 相关环境变量在 `backend/.env.example` 的 Admin Tools 段落（`ADMIN_TOOLS_ENABLED`、`ADMIN_TOOLS_SWAGGER_PORT`、`ADMIN_TOOLS_API_BASE_URL` 等）。
- 后端启动后若 `ADMIN_TOOLS_EMBEDDED` 为真，会在 `bootstrap.ts` 中调用 `startAdminTools`，将 Swagger 作为同进程服务启动。
- Admin Tools 默认配置：`ADMIN_TOOLS_ENABLED=false`，`ADMIN_TOOLS_SWAGGER_PORT` 默认 7216，`ADMIN_TOOLS_HOST` 默认 127.0.0.1，未启用不会启动 Swagger。
- `backend/package.json` 定义 `dev:tools` 脚本：`ts-node-dev --respawn --transpile-only src/adminTools/standalone.ts`。
- Swagger UI 路由在 Admin Tools 根路径 `/`，OpenAPI JSON 在 `/openapi.json`；访问需先通过鉴权登录。
- Admin Tools 鉴权依赖后端 token：支持 `Authorization: Bearer <token>`、`x-hookcode-token` 头或登录页写入 cookie。

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
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/AGENTS.md
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/src/adminTools/startAdminTools.ts
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/src/adminTools/standalone.ts
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/package.json
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/.env.example
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/src/bootstrap.ts
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/src/adminTools/config.ts
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/src/adminTools/swaggerApp.ts
- /Users/gaoruicheng/Documents/Github/hookvibe/hookcode/backend/src/adminTools/auth.ts

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
- **Session Hash:** p1qnl1d63n6c7wiob2wt
- **Created:** 2026-01-26

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
