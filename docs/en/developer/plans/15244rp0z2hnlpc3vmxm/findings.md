# Findings & Decisions: harden-github-actions-checkout-retries

## Session Metadata
- **Session Hash:** 15244rp0z2hnlpc3vmxm
- **Created:** 2026-03-20

## Requirements
- Fix the GitHub Actions checkout failure shown by transient `GnuTLS recv error (-110)` and `SSL connection timeout` errors on the self-hosted runner.
- Limit the change to `.github/workflows/ci.yml`.
- Preserve the existing CI behavior outside the checkout hardening logic.

## Research Findings
- `.github/workflows/ci.yml` originally used `actions/checkout@v4` with only `clean: true` in both `test` and `docker-build`.
- The failing fetch happens inside the checkout action before repository code is available, so later shell-step retries cannot help.
- `actions/checkout` exposes checkout and fetch-depth controls, but no workflow input specifically adds extra network retry logic or changes the Git transport protocol.
- The repository already documents a related clone failure and mitigates transient transport errors with `git -c http.version=HTTP/1.1` in backend clone logic.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Apply `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=http.version`, and `GIT_CONFIG_VALUE_0=HTTP/1.1` to checkout steps | Forces the Git transport used by checkout to match the repository's existing HTTP/1.1 fallback for transient TLS failures |
| Retry checkout at the workflow layer in both CI jobs | Extends resilience beyond the action's built-in fetch retries while keeping standard GitHub checkout semantics |
| Let the final checkout attempt fail naturally | Keeps CI failure behavior explicit if the runner has a sustained connectivity or certificate issue |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Recorder-owned session plan directory was not present when checked during implementation | Initialized the session locally with `HC_SKIP_DOCS_JSON_SYNC=1 bash .codex/agents/planning-recorder/scripts/init-session.sh 15244rp0z2hnlpc3vmxm harden-github-actions-checkout-retries` |
| Local environment did not have `actionlint` installed | Used Ruby YAML parsing and `git diff --check` to verify the workflow syntax and patch cleanliness |

## Resources
- `.github/workflows/ci.yml`
- `backend/src/agent/agent.ts`
- `docs/en/developer/plans/gitclone128-20260304/progress.md`
- `https://github.com/actions/checkout`
- `https://git-scm.com/docs/git-config/2.51.1.html`

## Visual/Browser Findings
- The checkout documentation review showed no dedicated retry-count or transport-protocol input for `actions/checkout`.
- The Git config documentation confirms `http.version` supports `HTTP/1.1`, so the workflow change relies on a supported Git setting rather than an ad-hoc environment hack.
