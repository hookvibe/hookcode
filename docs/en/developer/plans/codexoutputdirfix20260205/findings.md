# Findings & Decisions: Fix task-group workspace root path expansion
<!-- Capture task-group workspace root findings and decisions. docs/en/developer/plans/codexoutputdirfix20260205/task_plan.md codexoutputdirfix20260205 -->

## Session Metadata
- **Session Hash:** codexoutputdirfix20260205
- **Created:** 2026-02-05

## Requirements
- Fix HOOKCODE_TASK_GROUPS_ROOT so "~" expands to the user home directory instead of being treated as a relative segment.
- Keep relative paths resolved against HOOKCODE_BUILD_ROOT when no "~" or absolute path is provided.
- Update tests and any user-facing configuration docs affected by the change.

## Research Findings
- `backend/src/agent/agent.ts` resolves HOOKCODE_TASK_GROUPS_ROOT by trimming, checking `path.isAbsolute`, and otherwise joining with `BUILD_ROOT`, so a value like `~/.hookcode/task-groups` becomes `<BUILD_ROOT>/~/.hookcode/...`.
- Unit coverage for task-group root resolution lives in `backend/src/tests/unit/buildRootResolution.test.ts` and currently only exercises relative overrides.
- The example env entry in `backend/.env.example` documents HOOKCODE_TASK_GROUPS_ROOT as relative to HOOKCODE_BUILD_ROOT without mentioning "~" expansion.
- The root `pnpm test` script runs backend Jest tests and frontend Vitest tests in sequence.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Expand leading "~" to `os.homedir()` before absolute/relative checks. | Aligns with user expectation for "~" paths while preserving existing relative-path behavior. |
| Add unit coverage for "~" expansion and keep existing relative path test. | Prevents regressions and documents the expected resolution order. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `rg` search included a non-existent `src` path. | Re-ran search with only existing paths. |

## Resources
- `backend/src/agent/agent.ts`
- `backend/src/tests/unit/buildRootResolution.test.ts`
- `backend/.env.example`

## Visual/Browser Findings
- None.
