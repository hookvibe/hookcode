# Findings & Decisions: Happy tool/diff UI migration feasibility
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. yjlphd6rbkrq521ny796 */}

## Session Metadata
- **Session Hash:** yjlphd6rbkrq521ny796
- **Created:** 2026-01-20

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Initial request (analysis): assess feasibility of migrating `happy/` Codex/Claude tool-result views (diff/bash/patch) into `frontend/` to replace the current live task log UI. {/* Capture feasibility-analysis requirement. yjlphd6rbkrq521ny796 */}
- Follow-up request (implementation): implement the recommended JSONL route and refactor the live logs area into a structured execution UI (including diff rendering) for both TaskGroup chat and TaskDetail pages. {/* Add implementation requirement for the same session. yjlphd6rbkrq521ny796 */}

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `frontend/` is a Vite + React 18 + Ant Design web console, and already has a “live task logs / thought chain” UI: `TaskConversationItem` renders a collapsible log panel backed by SSE (EventSource) with a backend feature gate to avoid repeated 404 retries. {/* Identify current log viewer transport + gate. yjlphd6rbkrq521ny796 */}
- The live log UI entrypoint is `TaskLogViewer` (not a generic `LogViewer`), with `Alert`/`LogViewerSkeleton` for disabled/loading states. {/* Pin down current log UI entrypoint component. yjlphd6rbkrq521ny796 */}
- `TaskLogViewer` treats SSE as line-based text: it listens to `init` (`{logs: string[]}`) and `log` (`{line: string}`) events and renders them line-by-line in a `<pre>` without structured parsing. {/* Clarify current log payload contract & rendering. yjlphd6rbkrq521ny796 */}
- `happy/` splits diff rendering into “pure algorithm + UI”: `calculateUnifiedDiff()` (based on the `diff` npm package) is pure TS and portable; `DiffView.tsx` is a React Native view (`View/Text` + `react-native-unistyles` theme), so direct copy into `frontend/` (React DOM + AntD) has a high adaptation cost. {/* Assess portability of diff algorithm vs RN UI. yjlphd6rbkrq521ny796 */}
- `happy/` Codex views (e.g. `CodexDiffView`/`CodexBashView`) rely on structured `ToolCall` (`tool.input.*` like `unified_diff`, `parsed_cmd`) and implement “structured tool events → view components”. {/* Note happy UI expects structured tool events. yjlphd6rbkrq521ny796 */}
- Backend `GET /api/tasks/:id/logs/stream` currently only streams log lines: `init` returns `{logs: string[]}`, and incremental updates are `log` events (DB polling uses `{line}` explicitly). Reusing `happy/` ToolCall views depends on whether these lines already contain parseable structured fragments, or whether the backend must expose a structured event stream. {/* Check backend contract vs happy ToolCall UI needs. yjlphd6rbkrq521ny796 */}
- `TaskLogStreamEvent` is `{ line: string }`, and the producer is `backend/src/agent/agent.ts` publishing lines during execution; “live logs” are intentionally modeled as plain text, not first-class tool events. {/* Confirm backend log stream is intentionally plain-text. yjlphd6rbkrq521ny796 */}
- `backend/src/agent/agent.ts` follows “append line → persist → SSE publish”; `appendRawLog()` extracts Codex/Claude/Gemini `threadId` + token-usage deltas from some lines (so the stream already contains parseable signals), but still stores/streams the original raw lines. {/* Note existing server-side parsing hints but output stays line-based. yjlphd6rbkrq521ny796 */}
- The parseable signals are JSONL events: `taskTokenUsage.ts` shows Codex emits `type=thread.started` and `type=turn.completed` JSON lines (Claude/Gemini have similar JSON shapes), so promoting “plain text logs” to “parseable event stream” is plausible if tool-call JSON event types exist in the logs. {/* Record that agent logs already contain JSONL events. yjlphd6rbkrq521ny796 */}
- No existing tool-call/diff/patch structured parsing was found in `backend/src` (0 hits for `apply_patch`, `unified_diff`, `*** Begin Patch`, etc); backend currently only extracts token/threadId from JSON lines and does not model tool output as first-class events. {/* Confirm missing backend tool parsing. yjlphd6rbkrq521ny796 */}
- `TaskResult` (shared shape) currently centers around `logs?: string[]` and `outputText?: string` and has no “structured tool calls / messages / diff artifacts” fields. Migrating `happy` ToolView as a log replacement requires either (1) client-side parsing of log lines into a tool structure, or (2) extending backend storage/API to return structured tool events. {/* Record API model gap for tool-view migration. yjlphd6rbkrq521ny796 */}
- `happy/` has a full tool dispatcher layer: `ToolView.tsx` routes by `tool.name/state/input/result/permission` + `knownTools` + `getToolViewComponent()`, with a JSON fallback. This layered design can be recreated in `frontend/`, but RN dependencies (`react-native*`, `unistyles`, `expo-router`, icon packs) cannot be copied as-is. {/* Capture happy ToolView architecture & portability. yjlphd6rbkrq521ny796 */}
- `ToolDiffView.tsx` is a thin wrapper for wrap vs horizontal scroll (based on `wrapLinesInDiffs` setting). On the web this maps cleanly to CSS overflow, making it a good migration “entry point” conceptually. {/* Identify small, portable wrapper logic. yjlphd6rbkrq521ny796 */}
- `CodexPatchView.tsx` only shows a file list from `tool.input.changes` (no inline patch rendering). `EditView.tsx` is a typical pattern: parse tool input via schema → delegate to `ToolDiffView`. Many happy tool views are thin adapters; the migration hinges on having structured tool inputs and a web-friendly DiffView. {/* Understand tool views are mostly thin adapters. yjlphd6rbkrq521ny796 */}
- Comparing the two example formats (`example/codex/exec.txt` vs `example/codex/exec-json.txt`): JSONL is significantly easier and safer to render as a real-time UI because each line is a self-contained event with explicit boundaries (`item.started/item.completed` + `item.type=command_execution/file_change/...`), while the non-JSON format is marker-based (`thinking/exec/file update`) and requires brittle multi-line parsing. {/* Compare JSONL vs plain text for UI parsing. yjlphd6rbkrq521ny796 */}
- The JSONL example contains rich command metadata (`command`, `status`, `exit_code`, `aggregated_output`) and file-change summaries, but it does not include unified diffs/patch bodies; the non-JSON example embeds unified diffs directly in the log, which is convenient for diff viewers but less stable to parse/stream. {/* Highlight diff-body availability tradeoff. yjlphd6rbkrq521ny796 */}

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Use Codex JSONL (`codex exec --json`-style) as the primary UI data source | Stable event boundaries (`item.started/item.completed`) enable robust real-time rendering and filtering (e.g. hide reasoning by default). |
| Keep SSE contract unchanged (still streams `{line}`) and build a client-side JSONL parser | Minimizes API surface changes while enabling structured UI; raw mode remains available as a fallback. |
| Emit `hookcode.file.diff` JSONL events from backend on Codex `file_change` | Codex file_change items lack diff bodies; backend-generated diffs unlock rich UI without brittle plain-text parsing. |
| Rebuild diff UI in Web using portable `diff` algorithm | Reuses the proven algorithm from `happy/` while avoiding React Native dependency conflicts. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- Task logs SSE endpoint: `backend/src/modules/tasks/tasks.controller.ts` (`GET /api/tasks/:id/logs/stream`). {/* Track key backend endpoint file. yjlphd6rbkrq521ny796 */}
- Task type definitions: `backend/src/types/task.ts`, `frontend/src/api.ts` (confirm whether any structured tool/message fields can be reused). {/* Track model files for feasibility. yjlphd6rbkrq521ny796 */}

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
