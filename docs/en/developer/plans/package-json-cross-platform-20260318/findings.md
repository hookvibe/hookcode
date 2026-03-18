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
- The current generated Prisma client under `node_modules/.prisma/client` still reports `"engineType": "library"` and ships `query_engine-windows.dll.node`, which explains why Windows `prisma generate` keeps trying to replace a locked DLL.
- The same generated client directory contains multiple stale `query_engine-windows.dll.node.tmp*` files from failed rename attempts, so the current failure mode is repeatable in this workspace.
- Official Prisma docs say `engineType = "client"` can remove the Rust query engine binary entirely, but HookCode's current workspace still generates the default Rust-engine client and therefore needs a repo-local mitigation for the Windows DLL rename race.
- HookCode already satisfies that adapter requirement because [backend/src/db.ts](/c:/Users/yuhe/Documents/github/hookcode/backend/src/db.ts) instantiates `PrismaClient` with `new PrismaPg(pool)`.
- The backend `pnpm test` rerun now gets through `pretest` and fails in seven suites: three Windows path-separator assertions, one POSIX-only `ls` command test, two stale `TasksController` test setups, and one Windows command-abort timeout.
- The path failures are test expectation bugs, not product-code bugs: the received values are valid Windows paths such as `C:\\repo\\backend` and `\\repo\\.git`.
- The `runCommandCapture` failure is also a test issue because it still shells out to `ls`, which is not guaranteed on native Windows.
- The `taskLogsFeatureToggle` and `tasksVolumeByDayController` failures come from a newer `TasksController` constructor that now requires `TaskWorkspaceService`.
- The `agentCommandAbort` timeout points to real Windows process-tree behavior: killing the shell wrapper is not reliably terminating the spawned child process fast enough.
- The backend fixes now allow `pnpm test` to reach `hookcode-frontend`, where `frontend/src/tests/taskGroupChatPage.composer.test.tsx` still expects always-visible `Repository`, `Robot`, and `Worker` selects.
- The current `TaskGroupComposer` UI moved those selectors into a `Composer actions` popover and only leaves a compact footer with the settings button, optional time-window label, repo context text, and the send button visible by default.
- For unsupported task-group kinds, the composer settings button is disabled together with the textarea and send button, so the hidden context selects are no longer a reliable assertion target in tests.
- After the composer test fix, the only remaining root-suite failure is `frontend/src/tests/appShell.test.tsx`, where the first home-page assertion times out while the lazy-loaded `TaskGroupChatPage` route is still resolving.
- The later `AppShell` tests that assert the same home-page text pass after the route module is cached, which points to a cold-load timing issue in the test rather than a broken `#/` route.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `scripts/run-backend-dev.cjs` at the repo root | A small Node launcher is portable, avoids adding `cross-env`, and provides a place for the required traceability comment. |
| Resolve `pnpm` as `pnpm.cmd` on Windows and `pnpm` elsewhere | `spawn()` needs the executable name that matches the platform shell resolution behavior. |
| Export small pure helpers from the launcher and test them directly | That keeps tests deterministic and avoids launching long-running watch processes in CI. |
| Switch runtime shell-command execution to the shared `xSpawnShell()` helper instead of duplicating platform logic | That fixes the reported `spawn sh ENOENT` failure at the source and keeps shell behavior centralized. |
| Update command-execution tests to run Node-based commands instead of POSIX-only commands like `ls` | Tests should verify behavior, not silently depend on a Unix shell being present. |
| Harden `backend/scripts/prisma-run.js` with retry + stale-temp cleanup instead of changing Prisma generator mode mid-task | The reported failure is a transient Windows file-lock race, and the script-level fix is smaller, lower-risk, and easy to verify with a focused unit test plus the existing `pretest` entrypoint. |
| Prefer making the failing backend tests platform-aware instead of forcing POSIX path/command behavior | The reported backend suite failures are dominated by stale Unix-only assertions after the cross-platform spawn work. |
| Fix Windows abort behavior in `agent.ts` instead of only relaxing timeouts | Task stop semantics are user-visible runtime behavior, not just a test detail, so Windows process-tree termination should be correct in production too. |
| Update the frontend composer tests to drive the `Composer actions` popover instead of restoring the old inline selects | The component already matches the intended compact UI, so the failing assertions are stale test expectations rather than a product regression. |
| Stabilize `AppShell` home-page assertions with a shared longer-wait helper instead of rewriting the route logic | The root cause is test timing around the first lazy `TaskGroupChatPage` import, and the production route already resolves correctly later in the same suite. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The documented `bash` planning helper could not run in the local PowerShell environment | Session docs were created manually and docs navigation would be synced with a local script runner. |
| The first full-suite verification attempt depended on Prisma engine downloads during `hookcode-backend` `pretest` | Logged the failure, then reran the suite after the current workspace's Prisma script update allowed generation to succeed. |
| The rerun still failed in existing backend Windows-oriented gaps | Documented the failing suites as residual repo issues outside this package-script task. |
| Backend runtime still hard-codes `spawn('sh', ['-c', ...])` in multiple places despite having a shared cross-platform helper | Fix the callers to use the helper and add tests around the Windows-safe path. |
| Backend `pretest` now fails earlier with `EPERM` while Prisma tries to rename `query_engine-windows.dll.node.tmp*` over the active engine DLL | Keep the existing generator mode and add Windows-specific retry + stale-temp cleanup in `backend/scripts/prisma-run.js`, then cover the behavior with `prismaRun.test.ts`. |
| The backend suite still fails after `pretest` because several tests hard-code POSIX assumptions or lag behind constructor changes | Update those tests to reflect current Windows-safe behavior and the current Nest dependency graph. |
| The frontend suite still fails after the backend is fixed because the composer test file lags behind the current compact footer + popover workflow | Update the assertions to open the popover when validating repo/robot/worker selectors, and assert disabled footer controls for unsupported groups. |
| The frontend suite still has one failing shell test because the first home-route assertion races the lazy route import on a cold module cache | Update the repeated home-page assertion path to wait longer for the lazy home page before checking shell content. |

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
