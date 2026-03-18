# Task Plan: Cross-platform compatibility audit and fixes

## Session Metadata
- **Session Hash:** crossplatformcompat20260318
- **Created:** 2026-03-18

## Goal
Audit the HookCode monorepo for Windows, macOS, and Linux compatibility risks, implement pragmatic fixes for confirmed issues, and verify the affected workflows with automated tests.

## Current Phase
Phase 5

## Phases
### Phase 1: Repository Discovery
- [x] Confirm task scope and repo workflow constraints
- [x] Create the planning session and capture baseline metadata
- [x] Identify cross-platform risk surfaces in scripts, runtime spawning, and file/path handling
- **Status:** complete

### Phase 2: Compatibility Audit
- [x] Scan root scripts, package scripts, and local automation entrypoints
- [x] Scan backend, worker, and frontend runtime code for OS/path/process assumptions
- [x] Record confirmed issues and proposed fixes in findings.md
- **Status:** complete

### Phase 3: Implementation
- [x] Implement focused fixes for confirmed compatibility issues
- [x] Add or update inline traceability comments in each changed area
- [x] Add or update automated tests for the fixed behavior
- **Status:** complete

### Phase 4: Verification
- [x] Run targeted tests during implementation
- [x] Run the full test suite after test changes
- [x] Record verification results and residual risks in progress.md
- **Status:** complete

### Phase 5: Delivery
- [x] Re-read the plan and confirm all phases are complete
- [x] Update the unreleased changelog entry with the session hash and plan link
- [x] Summarize the fixes, tests, and remaining limitations for the user
- **Status:** complete

## Key Questions
1. Which current scripts or runtime helpers assume POSIX shells, POSIX path separators, or Unix-only binaries?
2. Which compatibility issues can be fixed centrally so all packages inherit safer behavior?
3. Which workflows can be validated with deterministic tests instead of manual OS-specific execution?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with a repository-wide static audit before editing code | The user asked for a full scan, so the fix scope must be grounded in an explicit inventory of compatibility risks. |
| Prioritize Node-based scripts, runtime spawning, and path handling first | These areas are the highest-probability sources of Windows/macOS/Linux breakage in a pnpm monorepo. |
| Fix compatibility issues through shared helpers where possible | Centralizing shell/process behavior reduces the number of OS-specific edge cases that can drift back out of sync later. |
| Replace `.bin` shim paths with package bin entrypoints for Node-based scripts | Running package entry files with `process.execPath` avoids Windows-only `.cmd` lookup differences and keeps scripts deterministic. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Template duplication in generated `findings.md` | 1 | Replaced the file with a clean session-specific findings document before continuing the audit. |
| Initial backend runtimeService test mock did not exercise the detector reliably | 1 | Replaced the mock-heavy test with a module-isolation test that asserts the Windows detector order directly. |

## Notes
- Re-read this plan before major implementation decisions.
- Keep findings and progress synchronized with each audit batch and verification step.
- Every changed code area must include an English inline traceability comment with `docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318`.
