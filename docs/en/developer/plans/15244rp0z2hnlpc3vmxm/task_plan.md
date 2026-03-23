# Task Plan: harden-github-actions-checkout-retries

## Session Metadata
- **Session Hash:** 15244rp0z2hnlpc3vmxm
- **Created:** 2026-03-20

## Goal
Harden `.github/workflows/ci.yml` checkout behavior on self-hosted runners so transient GitHub TLS or SSL fetch failures do not fail CI immediately.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Confirm the fix stays in workflow code because checkout fails before repo code is available
- [x] Reuse the existing repository rationale for `http.version=HTTP/1.1`
- **Status:** complete

### Phase 3: Implementation
- [x] Add checkout hardening in the `test` job
- [x] Add checkout hardening in the `docker-build` job
- [x] Keep required inline traceability comments in the changed workflow areas
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Validate the workflow YAML parses successfully
- [x] Check the workflow diff for whitespace or syntax issues
- [x] Confirm the working tree change is limited to the intended workflow file
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize the workflow fix and residual risks
- [x] Finalize recorder bookkeeping and changelog entry
- [x] Deliver the result to the user
- **Status:** complete

## Key Questions
1. Can `actions/checkout` be hardened without replacing it? Yes. Step-level `GIT_CONFIG_COUNT` can inject `http.version=HTTP/1.1`, and workflow-level retries can wrap the action.
2. Should the fix live in workflow YAML instead of backend code or shell steps? Yes. The failure happens during checkout before repository code is available.
3. What remains unresolved after the fix? Sustained runner connectivity or certificate failures to `github.com` can still break the final checkout attempt.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep `actions/checkout@v4` and add step-level `http.version=HTTP/1.1` overrides | Preserves GitHub auth/ref behavior while reusing the same transport mitigation already documented for repository clone failures |
| Add two workflow-level retry attempts in each job | Augments the action's built-in fetch retries without introducing custom clone logic |
| Scope the Git config overrides to checkout steps only | Avoids leaking transport configuration into unrelated CI steps |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Recorder plan path was missing locally during wrap-up | 1 | Ran `init-session.sh` with the chosen session hash so final bookkeeping could proceed |
| `actionlint` was not installed in the local environment | 1 | Used YAML parsing plus `git diff --check` as local validation instead |

## Notes
- Reused the repository's existing `HTTP/1.1` transport fallback rationale from `gitclone128-20260304`.
- No user-facing docs or API reference pages required updates for this workflow-only fix.
