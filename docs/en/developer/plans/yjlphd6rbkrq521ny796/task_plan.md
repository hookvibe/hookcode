# Task Plan: Structured execution viewer — JSONL + diffs (replace live logs)
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. yjlphd6rbkrq521ny796 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** yjlphd6rbkrq521ny796
- **Created:** 2026-01-20

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Replace the raw SSE live-log `<pre>` with a structured execution viewer in `frontend/` (Codex JSONL parsing + web diff rendering), and emit backend diff artifacts (`hookcode.file.diff`) so TaskGroup chat and TaskDetail pages can show rich diffs. {/* Update goal to reflect implemented scope. yjlphd6rbkrq521ny796 */}

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 5

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Inspect `frontend/` realtime logs (`TaskLogViewer` + SSE contract)
- [x] Inspect `happy/` tool/diff view architecture and dependencies
- [x] Inspect backend SSE/log storage model and TaskResult shape
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

{/* Reopen the plan for implementation work after the initial feasibility analysis. yjlphd6rbkrq521ny796 */}
### Phase 2: Web UI Implementation
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Add JSONL log parser + normalized event model
- [x] Replace `TaskLogViewer` usage in TaskGroup + TaskDetail pages with structured viewer
- [x] Build web diff viewer component
- **Status:** complete

### Phase 3: Backend Diff Events
{/* WHAT: Emit diff artifacts from backend so the web UI can render rich diffs. WHY: Codex JSONL file_change events do not include diff bodies; backend needs to attach diffs. */}
- [x] Intercept Codex `file_change` events and capture diffs (git diff / snapshots)
- [x] Emit `hookcode.file.diff` JSONL events into task logs
- [x] Add backend unit tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Add frontend unit tests for parsing + rendering helpers
- [x] Run `pnpm --filter hookcode-frontend test`
- [x] Run `pnpm --filter hookcode-backend test`
- [x] Run `pnpm --filter hookcode-frontend build` and `pnpm --filter hookcode-backend build`
- **Status:** complete

### Phase 5: Delivery
- [x] Update `docs/en/change-log/0.0.0.md`
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Does `frontend/` already have structured tool data that can be rendered directly? (No: only `logs?: string[]` and `outputText?: string` today.) {/* Answer key question about data. yjlphd6rbkrq521ny796 */}
2. Can the existing SSE line stream reliably reconstruct `happy/`-style ToolCall views? (Unclear: depends on whether logs include tool-call JSON events; backend does not currently parse/model them.) {/* Clarify uncertainty & dependency. yjlphd6rbkrq521ny796 */}
3. What is the lowest-risk migration path? (Rebuild a web dispatcher + diff renderer; parse recognizable JSONL events first; fallback to raw logs; add backend structured events if needed.) {/* Record recommended path. yjlphd6rbkrq521ny796 */}

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Do not copy RN components from `happy/` into `frontend/` | Stack mismatch (React Native/Unistyles/Expo Router vs React DOM/AntD) would add heavy dependencies and compatibility cost. |
| Reuse pure algorithms/parsers (e.g. unified diff) and rebuild UI in web | Logic is portable; web UI (DOM/CSS) is lighter and aligns with the existing `frontend/` component system. |
| Structured views must be backed by parseable events (prefer JSONL parsing; add backend structured stream if needed) | Current SSE/DB stores only string lines; without tool-call events, `ToolView` parity is not reliable. |
| Prefer JSONL execution logs as the primary UI input (keep plain-text parsing as a fallback) | JSONL provides stable, stream-friendly event boundaries (`item.started/item.completed`) and makes it easy to filter sensitive reasoning; plain-text logs are useful mainly for embedded diff bodies but are brittle to parse. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
