# Findings & Decisions: Cross-platform compatibility audit and fixes

## Session Metadata
- **Session Hash:** crossplatformcompat20260318
- **Created:** 2026-03-18

## Requirements
- Audit the HookCode codebase for compatibility issues across Windows, macOS, and Linux.
- Fix confirmed compatibility problems instead of only reporting them.
- Preserve the repository workflow requirements from `AGENTS.md`, including planning docs, inline traceability comments, tests, and changelog updates.

## Research Findings
- The repo is a pnpm workspace with `backend`, `frontend`, `docs`, and `worker` packages, so compatibility issues may exist in shared root scripts as well as per-package code.
- The root `package.json` already prefers Node-based entrypoints for `dev:backend` and root tests, which suggests existing compatibility work has started and the remaining risks are likely in lower-level scripts and runtime helpers.
- The working tree was clean before the audit started, so any later diffs in this session can be attributed to the compatibility work.
- Confirmed script-entrypoint risk: `frontend/scripts/run-vitest.cjs` relied on `node_modules/.bin/vitest`, which is fragile on Windows because the actual executable is commonly exposed through `vitest.cmd`/package bin metadata rather than an extensionless file.
- Confirmed worker command-probing risk: `worker/src/runtime/prepareRuntime.ts` used raw `spawnSync('pnpm', ...)`, and `worker/src/runtime/hostCapabilities.ts` only probed `python3`, both of which can under-detect tooling on Windows.
- Confirmed process-termination risk: worker execution, preview processes, local worker supervision, admin-tools Prisma Studio, and Gemini CLI aborts all had code paths that could stop only the shell wrapper instead of the full child process tree on Windows.
- Confirmed repo-command risk: several backend git flows embedded `cd ${repoDir} && ...`, which breaks on Windows drive changes and any repo path containing spaces.
- Confirmed diff-source risk: backend and worker created-file snapshots depended on `/dev/null`, which is Unix-specific and breaks Windows diff generation for new files.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Treat shell/process execution, file paths, temp directories, and executable resolution as the primary audit categories | These are the most common causes of cross-platform failures in Node/TypeScript monorepos. |
| Record only confirmed issues as implementation targets | A broad static scan can produce many false positives; fixes should be tied to code paths with an actual compatibility risk. |
| Normalize backend and worker process shutdown through tree-aware helpers | This fixes the Windows-specific orphan-process failure mode without changing higher-level business logic. |
| Use `cwd` instead of shell-level `cd ... &&` for repo-scoped git commands | `cwd` is cross-platform, handles spaces safely, and avoids Windows cross-drive `cd` failures. |
| Replace `/dev/null` with generated empty diff sources and normalize headers back to `/dev/null` | This preserves repo-relative patch output for the UI while making created-file diffs portable to Windows. |
| Probe Python with launcher fallbacks (`python`, `py -3`, `python3`) where needed | Windows installations frequently expose Python under `python` or `py`, so single-command probing under-reports runtime support. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The generated `findings.md` template was duplicated by the init template content | Replaced it with a clean session-specific findings file before continuing the audit. |
| The first backend runtimeService test relied too heavily on `promisify(execFile)` mocking details | Replaced it with a module-isolation detector-order test that directly validates the Windows probe configuration. |

## Resources
- `package.json`
- `.codex/skills/file-context-planning/SKILL.md`
- `docs/en/developer/plans/crossplatformcompat20260318/task_plan.md`
- `frontend/scripts/run-vitest.cjs`
- `backend/scripts/prisma-run.js`
- `backend/src/agent/agent.ts`
- `backend/src/utils/workspaceChanges.ts`
- `worker/src/runtime/repoChangeTracker.ts`

## Visual/Browser Findings
- None. This task has used local repository inspection only.
