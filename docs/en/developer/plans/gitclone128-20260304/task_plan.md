# Task Plan: Diagnose git clone code 128 in task group worker

## Session Metadata
- **Session Hash:** gitclone128-20260304
- **Created:** 2026-03-04

## Goal
Find the root cause of `git clone ... command failed with code 128` in backend task-group execution, implement a robust fix, and verify with tests.

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Root Cause Analysis
- [x] Locate the exact backend clone execution path
- [x] Identify concrete failure mode(s) behind exit code 128
- [x] Confirm impact scope and reproducibility
- **Status:** complete

### Phase 3: Implementation
- [x] Implement fix for identified root cause
- [x] Add or update inline traceability comments at changed code areas
- [x] Add or update tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted tests
- [x] Run required full test suite after adding tests
- [x] Record results in progress.md
- **Status:** complete

### Phase 5: Delivery
- [x] Complete plan/progress/findings updates
- [x] Update `docs/en/change-log/0.0.0.md`
- [x] Summarize root cause, fix, and validation to user
- **Status:** complete

## Key Questions
1. Where is the clone URL built and executed in backend task-group flow?
2. Is exit code 128 caused by auth, malformed URL, path state, or git runtime environment?
3. What minimal code change can both fix and improve observability safely (without leaking secrets)?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use file-context-planning session docs first | Required by repository workflow and needed for traceability |
| Investigate backend execution chain before hypothesizing | Exit code 128 is generic; code path evidence is required |
| Query the production task logs using `hookcode-pat-api-debug` | Needed to replace guesswork with exact `fatal` diagnostics for this task group |
| Add git clone transport fallback (`http.version=HTTP/1.1`) for transient TLS/HTTP2 failures | The real error is OpenSSL EOF during HTTPS clone, not credential mismatch |
| Include redacted stderr details in thrown command errors | Prevent future `code 128` reports from losing actionable root-cause context |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]` | 1 | Continued with created plan files because session directory was initialized successfully |
| PAT request to `/api/users/me` returned 404 | 1 | Corrected path to `/api/...` routes and used `/api/task-groups/...` + `/api/tasks/.../logs` |

## Notes
- Re-read this plan before major implementation decisions.
- Keep findings updated after each exploration block.
