# Task Plan: Make root package scripts work on Windows and macOS

## Session Metadata
- **Session Hash:** package-json-cross-platform-20260318
- **Created:** 2026-03-18

## Goal
Make the root [package.json](/c:/Users/yuhe/Documents/github/hookcode/package.json) scripts and backend command-execution paths behave consistently on Windows and macOS by removing shell-specific assumptions from local dev and task runtime flows.

## Current Phase
Phase 5 complete

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Confirm whether an existing helper can be reused
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Add a cross-platform backend dev launcher
- [x] Update root scripts to use the launcher
- [x] Add test coverage for script behavior
- [x] Replace backend `sh -c` task/runtime spawns with cross-platform shell helpers
- [x] Add or update tests that cover Windows-safe command execution
- [x] Fix prisma-run.js spawn for Node.js v24 on Windows (shell: true)
- [x] Fix CRLF checksum mismatch in schemaMigrations.ts
- [x] Fix NestJS DI missing RepositoriesModule import
- [x] Create worker/src/runtime/crossPlatformSpawn.ts for worker package
- [x] Migrate all backend spawn/exec callsites to use crossPlatformSpawn utils
- [x] Migrate all worker spawn/exec callsites to use crossPlatformSpawn utils
- [x] Fix frontend/scripts/run-vitest.cjs for Windows
- [x] Prevent Windows `prisma generate` from rewriting a locked Rust query engine DLL during backend pretest
- [x] Add regression coverage for the Prisma generate behavior change
- [x] Fix Windows-specific path expectation failures in backend unit tests (`workDir`, `dependencyInstaller`, `codexProviderConfig`)
- [x] Fix backend command-capture/abort behavior so Windows command tests stop hanging
- [x] Update stale `TasksController`-based tests for the current dependency list
- [x] Update stale frontend composer tests to match the current popover-based TaskGroup composer UI
- [x] Stabilize `AppShell` home-page assertions for the lazy-loaded `TaskGroupChatPage` route during full-suite runs
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted verification for the launcher and backend shell helpers
- [x] Run the full test suite because new tests are added
- [x] Record outcomes in progress.md
- [x] Re-run `node scripts/prisma-run.js generate` on Windows after the follow-up change
- [x] Re-run the backend test entrypoint that triggers `pretest`
- [x] Re-run the full backend Jest suite until it passes on Windows
- [x] Re-run the targeted frontend composer spec after updating it for the new popover workflow
- [x] Re-run the targeted AppShell spec after hardening the home-page wait path
- [x] Re-run the full root `pnpm test` suite until it passes on Windows
- **Status:** complete

### Phase 5: Delivery
- [x] Update changelog entry
- [x] Review touched files and docs
- [x] Deliver the result to the user
- **Status:** complete

## Key Questions
1. Which root scripts currently depend on shell-specific syntax?
2. What is the smallest repo-native change that keeps behavior the same on both Windows and macOS?
3. Which backend runtime paths still hard-code `sh -c` and therefore fail on native Windows environments?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Replace inline `ADMIN_TOOLS_EMBEDDED=false ...` with a Node launcher script | JSON scripts cannot contain inline traceability comments, and a Node launcher is cross-platform without adding a new dependency. |
| Add a `node:test` file for the launcher | The repo requires new behavior to include tests, and command/env resolution is easy to verify in-process. |
| Reuse `backend/src/utils/crossPlatformSpawn.ts` for backend shell command strings | The repo already has a centralized Windows-safe shell abstraction, so runtime command execution should stop open-coding `spawn('sh', ['-c', ...])`. |
| Retry Prisma generate after transient Windows DLL rename locks and clean stale temp files between attempts | The repo still uses the default Prisma Rust engine layout, so the smallest safe fix is to harden `backend/scripts/prisma-run.js` around the observed `EPERM ... query_engine-windows.dll.node.tmp*` rename race. |
| Update stale frontend tests to follow the current popover and lazy-route behavior instead of restoring older UI contracts | The remaining failures were test drift after the compact composer/footer cleanup and lazy AppShell route split, not product regressions. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `bash` was not available in the PowerShell environment when trying to run the planning init script | 1 | Recreated the session files manually with `apply_patch` and planned to sync docs navigation with a local script runner instead of `bash`. |
| `pnpm test` stopped in `hookcode-backend` `pretest` because Prisma tried to download a Windows schema engine checksum from `https://binaries.prisma.sh/...` and the request failed | 1 | Recorded the failure as an environment-dependent verification issue because the new root compatibility test already passed and the failing step is unrelated to the changed launcher. |
| A later `pnpm test` rerun passed Prisma generation but still failed in existing backend test suites because several tests hard-code POSIX paths, assume `sh` exists, or lag behind the current `TasksController` constructor signature | 2 | Logged the failing suites as pre-existing Windows portability gaps outside the root `package.json` launcher change. |
| Task runtime on Windows still fails with `spawn sh ENOENT` during clone fallback, git-status capture, and preview process startup | 1 | Investigated the backend source and confirmed several execution paths still bypass the shared cross-platform spawn helper. |
| `node scripts/prisma-run.js generate` now fails on Windows with `EPERM ... rename ... query_engine-windows.dll.node.tmp*` during backend `pretest` | 1 | Added Windows-specific Prisma generate retry/cleanup handling in `backend/scripts/prisma-run.js` plus regression coverage in `backend/src/tests/unit/prismaRun.test.ts`, then re-ran `generate` successfully. |
| `pnpm --filter hookcode-backend test` still fails on Windows after `pretest` succeeds | 1 | Updated the remaining path-separator assertions, stale controller test wiring, and Windows command-abort behavior, then re-ran the full backend suite until it passed. |
| `pnpm test` now reaches `hookcode-frontend` and fails in `taskGroupChatPage.composer.test.tsx` because the composer context selectors moved behind the `Composer actions` popover | 1 | Updated the composer tests to open the current popover UI and assert the current footer-disabled behavior instead of expecting always-rendered labeled selects. |
| `pnpm test` now only fails in `frontend/src/tests/appShell.test.tsx` because the first home-page assertion races the lazy `TaskGroupChatPage` import during the full suite | 1 | Replaced the repeated direct home-page `findByText` calls with a shared longer-wait helper and confirmed the targeted AppShell file plus the full root suite both pass. |

## Notes
- Re-read this plan before major decisions.
- Keep session traceability in every changed code area that supports comments.
