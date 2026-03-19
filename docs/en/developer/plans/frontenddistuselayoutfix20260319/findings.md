# Findings & Decisions: Fix frontend dist useLayoutEffect runtime error



# Findings & Decisions: Fix frontend dist useLayoutEffect runtime error
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. frontenddistuselayoutfix20260319 */}

## Session Metadata
- **Session Hash:** frontenddistuselayoutfix20260319
- **Created:** 2026-03-19

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Preserve the existing `frontend dev` behavior while fixing the production-only runtime error in `frontend/dist`.
- Root-cause the `vendor-misc-CSyIL6Xj.js` crash instead of masking it with component-level changes.
- Keep the final change traceable through this session folder and verify the emitted production assets after the fix.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `frontend/src` contains legitimate `useLayoutEffect` usage, but the crash site is the emitted `frontend/dist/assets/vendor-misc-CSyIL6Xj.js`, so the bundle output is the primary investigation target.
- `frontend/vite.config.ts` uses a broad `manualChunks` function that isolates `/react/` and `/react-dom/` into `vendor-react` while sending all unmatched `node_modules` packages to `vendor-misc`.
- The emitted `vendor-misc-CSyIL6Xj.js` imports `r as h` from `vendor-react-DfDJPzum.js` and immediately evaluates code that reads `h.useLayoutEffect`.
- The emitted `vendor-react-DfDJPzum.js` imports `cQ as $a` from `vendor-misc-CSyIL6Xj.js`, creating a production chunk cycle between `vendor-react` and `vendor-misc`.
- The cycle is consistent with React namespace exports being observed before initialization, which explains `Cannot read properties of undefined (reading 'useLayoutEffect')`.
- Re-reading the rebuilt assets shows the deeper issue persists: `vendor-react-BBZwU97y.js` imports `g as tf` from `vendor-antd-BQQjq5uF.js`, while `vendor-antd-BQQjq5uF.js` imports React symbols back from `vendor-react-BBZwU97y.js`.
- `vendor-antd-BQQjq5uF.js` also imports a large symbol set from `vendor-misc-EfDEo_q_.js`, so the current manual chunk layout still spreads React-adjacent runtime code across mutually dependent vendor chunks.
- After simplifying the chunk strategy, the final build emits one primary `vendor-t_mVVbgc.js` chunk plus isolated `vendor-markdown`, `vendor-workspace`, and `vendor-charts` chunks.
- The final `vendor-t_mVVbgc.js` starts with local helper/runtime code and has no `import` statement, while `vendor-markdown` and `vendor-workspace` only import the primary vendor chunk.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Use the built chunk graph to identify the failure boundary before editing source hooks | The error reproduces only after build, and the emitted imports already show a React chunk cycle. |
| Extract the manual chunk classifier into a shared helper and test it directly | The build rule is now the regression surface, so the fix should be verifiable without relying only on manual asset inspection. |
| Collapse most node_modules into one primary vendor chunk and keep only clearly isolated heavy dependencies split out | The current fine-grained manual chunks let Rollup place helpers and React-adjacent modules in cyclic vendor chunks, which is less safe than a coarser boundary. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| React-related runtime code was split across `vendor-react` and `vendor-misc`, creating a circular import in the emitted assets | Resolved by classifying `/scheduler/` into `vendor-react`, which removes the `vendor-react` import from `vendor-misc` in the rebuilt assets. |
| `frontend/src/build/vendorChunking.ts` matched the repo-level `build` ignore rule and would not appear in Git | Resolved by moving the shared helper to `frontend/src/utils/vendorChunking.ts` and rerunning tests/build against the tracked path. |
| The rebuilt assets still keep `vendor-react` and `vendor-antd` in a cycle via Rollup helper imports | Resolved by collapsing most shared dependencies into one primary vendor chunk; the final `vendor-t_mVVbgc.js` no longer imports any other vendor chunk. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/vite.config.ts`
- `frontend/src/utils/vendorChunking.ts`
- `frontend/src/tests/vendorChunking.test.ts`
- `frontend/dist/assets/vendor-misc-CSyIL6Xj.js`
- `frontend/dist/assets/vendor-react-DfDJPzum.js`
- `frontend/dist/assets/vendor-misc-EfDEo_q_.js`
- `frontend/dist/assets/vendor-react-BBZwU97y.js`
- `frontend/dist/assets/vendor-t_mVVbgc.js`
- `frontend/dist/assets/vendor-markdown-DFNrgrZZ.js`
- `frontend/dist/assets/vendor-workspace-iMk_XMmM.js`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- No browser tooling was needed yet; the critical observation came from reading the emitted JS imports in `frontend/dist/assets`.

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
