# Findings & Decisions: Make root package scripts work on Windows and macOS

## Session Metadata
- **Session Hash:** package-json-cross-platform-20260318
- **Created:** 2026-03-18

## Requirements
- Make the root [package.json](/c:/Users/yuhe/Documents/github/hookcode/package.json) command set work on both Windows and macOS.
- Preserve the existing behavior where backend dev starts with `ADMIN_TOOLS_EMBEDDED=false`.
- Follow repo workflow requirements: session docs, traceability comments where supported, tests, progress logging, and changelog updates.

## Research Findings
- The only shell-specific root script found is `dev:backend`, which currently uses Unix-style inline environment assignment: `ADMIN_TOOLS_EMBEDDED=false pnpm --filter hookcode-backend dev`.
- Root `dev` uses `concurrently`, which is already cross-platform for quoted subcommands in npm/pnpm scripts.
- Backend package scripts themselves do not use inline env assignment; the incompatibility is isolated to the root script entry point.
- The repo already uses CommonJS helper launchers, such as [frontend/scripts/run-vitest.cjs](/c:/Users/yuhe/Documents/github/hookcode/frontend/scripts/run-vitest.cjs), so a root `.cjs` launcher fits existing conventions.
- The new launcher test passes on the current Windows environment, which confirms the command name resolution and environment override logic for both Windows and non-Windows branches.
- A later full `pnpm test` rerun passed Prisma generation and then exposed 7 existing backend test failures on Windows: `codexProviderConfig`, `dependencyInstaller`, `tasksVolumeByDayController`, `taskLogsFeatureToggle`, `agentCommandAbort`, `workDir`, and `runCommandCapture`.
- Those backend failures are not caused by the new root launcher; they come from existing POSIX path assertions, direct `sh` process assumptions, and tests that no longer match the current `TasksController` constructor signature.
- The concrete runtime failure reported by the user is not a path-parsing bug first; it is a shell-launch bug first, because the stack trace shows `syscall: 'spawn sh'` and `code: 'ENOENT'`.
- [backend/src/utils/crossPlatformSpawn.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/utils/crossPlatformSpawn.ts) already provides `xSpawnShell()` that uses `cmd /c` on Windows and `sh -c` on POSIX, but backend runtime code is not using it yet.
- Current native Windows-sensitive call sites include [backend/src/agent/agent.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/agent/agent.ts) for `runCommandWithLogs()` and `runCommandCapture()`, plus [backend/src/modules/tasks/preview.service.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/modules/tasks/preview.service.ts) for preview process startup.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `scripts/run-backend-dev.cjs` at the repo root | A small Node launcher is portable, avoids adding `cross-env`, and provides a place for the required traceability comment. |
| Resolve `pnpm` as `pnpm.cmd` on Windows and `pnpm` elsewhere | `spawn()` needs the executable name that matches the platform shell resolution behavior. |
| Export small pure helpers from the launcher and test them directly | That keeps tests deterministic and avoids launching long-running watch processes in CI. |
| Switch runtime shell-command execution to the shared `xSpawnShell()` helper instead of duplicating platform logic | That fixes the reported `spawn sh ENOENT` failure at the source and keeps shell behavior centralized. |
| Update command-execution tests to run Node-based commands instead of POSIX-only commands like `ls` | Tests should verify behavior, not silently depend on a Unix shell being present. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The documented `bash` planning helper could not run in the local PowerShell environment | Session docs were created manually and docs navigation would be synced with a local script runner. |
| The first full-suite verification attempt depended on Prisma engine downloads during `hookcode-backend` `pretest` | Logged the failure, then reran the suite after the current workspace's Prisma script update allowed generation to succeed. |
| The rerun still failed in existing backend Windows-oriented gaps | Documented the failing suites as residual repo issues outside this package-script task. |
| Backend runtime still hard-codes `spawn('sh', ['-c', ...])` in multiple places despite having a shared cross-platform helper | Fix the callers to use the helper and add tests around the Windows-safe path. |

## Resources
- [package.json](/c:/Users/yuhe/Documents/github/hookcode/package.json)
- [backend/package.json](/c:/Users/yuhe/Documents/github/hookcode/backend/package.json)
- [frontend/scripts/run-vitest.cjs](/c:/Users/yuhe/Documents/github/hookcode/frontend/scripts/run-vitest.cjs)
- [.codex/skills/file-context-planning/scripts/sync-docs-json-plans.sh](/c:/Users/yuhe/Documents/github/hookcode/.codex/skills/file-context-planning/scripts/sync-docs-json-plans.sh)
- [backend/src/utils/crossPlatformSpawn.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/utils/crossPlatformSpawn.ts)
- [backend/src/agent/agent.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/agent/agent.ts)
- [backend/src/modules/tasks/preview.service.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/modules/tasks/preview.service.ts)

## Visual/Browser Findings
- None.
