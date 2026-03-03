# Task Plan: Investigate 127.0.0.1 preview access issue
<!-- Define concrete investigation phases for loopback hostname mismatch. docs/en/developer/plans/preview-loopback-host-20260303/task_plan.md preview-loopback-host-20260303 -->

## Session Metadata
- **Session Hash:** preview-loopback-host-20260303
- **Created:** 2026-03-03

## Goal
Identify the root cause of why preview is unreachable on `127.0.0.1:10000` while reachable on `localhost:10000`, then implement and verify a fix in project config/code.

## Current Phase
Complete

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm user-reported behavior and scope
- [x] Locate active `.hookcode.yml` and preview-related code paths
- [x] Record early findings and constraints
- **Status:** complete

### Phase 2: Root Cause Analysis
- [x] Trace preview host/URL generation flow end-to-end
- [x] Reproduce mismatch conditions locally
- [x] Decide minimal, robust remediation strategy
- **Status:** complete

### Phase 3: Implementation
- [x] Apply targeted config/code fix
- [x] Add or update inline traceability comments in changed code
- [x] Assess whether automated tests are needed for the affected behavior
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run relevant targeted checks
- [x] Run full test suite if new tests are added
- [x] Validate preview URL/access behavior post-fix
- **Status:** complete

### Phase 5: Delivery & Documentation
- [x] Update progress and findings documents
- [x] Update `docs/en/change-log/0.0.0.md`
- [x] Summarize root cause, fix, and verification results to user
- **Status:** complete

## Key Questions
1. Which module decides preview host and URL shown in HookCode for `hookcode.yml` previews?
2. Is the mismatch caused by network binding (`localhost`/`::1`/`127.0.0.1`) or by URL rewriting/validation rules?
3. What is the safest default to guarantee access in this environment while keeping existing behavior stable?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with a non-invasive investigation from config to runtime code | Fastest way to isolate whether issue is declarative (`.hookcode.yml`) or runtime rewriting |
| Replace `pnpm dev -- --host ...` with `pnpm dev --host ...` in `.hookcode.yml` | Verified that the previous syntax passed a literal `--` to Vite and silently disabled host binding |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]` | 1 | Treated as non-blocking for this task; continue with manual plan-file updates |

## Notes
- Re-read this plan before making implementation decisions.
- Keep traceability hash in every changed code area comment.
