# Findings & Decisions: Diagnose git clone code 128 in task group worker

## Session Metadata
- **Session Hash:** gitclone128-20260304
- **Created:** 2026-03-04

## Requirements
- User reports runtime error: backend executes `git clone https://eh-uy-a:***@github.com/hookvibe/hookcode.git ...` and exits with code 128.
- Need investigation and practical fix, not only speculation.
- Follow repository planning workflow and traceability rules.

## Research Findings
- Session initialization script created required plan files but returned one docs navigation error unrelated to runtime clone behavior.
- The failure message already shows clone URL includes inline credentials; this suggests URL assembly/auth handling is part of root-cause candidate set.
- Clone execution path is `backend/src/agent/agent.ts`: `cloneRepo()` calls `streamCommand(...)`, and `streamCommand` currently throws only `command failed with code <n>`.
- ThoughtChain command text appends `(${workspaceLabel})` only for UI display; this suffix is not part of the actual shell command executed.
- Current failure handling drops `git` stderr context (for example `fatal: ...`), which makes code-128 incidents hard to diagnose from UI/API responses.
- Local reproduction confirmed `git` code 128 can represent network/auth access failures depending on runtime environment, so surfacing stderr detail is required for precise diagnosis.
- Using `hookcode-pat-api-debug` with the provided PAT, task group `107758e0-a006-45e5-b329-a3967b04ca8f` and task `077d16e7-32f8-4644-aef1-60f22b160624` were inspected directly.
- Raw task logs show the exact failure: `fatal: unable to access ... OpenSSL SSL_read ... unexpected eof while reading` during both branch clone and fallback clone.
- Root cause for this incident is transient HTTPS transport/TLS failure to GitHub, not repository path formatting and not confirmed credential-scope denial.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Diagnose from backend clone execution source and logs first | `git` exit code 128 is generic and cannot be resolved safely without context |
| Keep secret-safe logging in any fix | Security requirements prohibit logging raw tokens/passwords |
| Fix observability gap in command failure message first | Returning redacted stderr highlights real root cause (auth/network/path) without exposing secrets |
| Add clone retry with `git -c http.version=HTTP/1.1` for retryable transport errors | Matches observed OpenSSL EOF failure mode and keeps normal path unchanged |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` exited non-zero due to docs navigation check | Continue with generated session files and log issue in plan/progress |
| Initial PAT request path mismatch (`/api/users/me` 404) | Switched to known `/api/*` task endpoints from OpenAPI and controllers |

## Resources
- `docs/en/developer/plans/gitclone128-20260304/task_plan.md`
- `.codex/skills/file-context-planning/SKILL.md`
- `backend/src/agent/agent.ts`
- `backend/src/tests/unit/taskGroupWorkspace.test.ts`
- `.codex/skills/hookcode-pat-api-debug/SKILL.md`
- `.codex/skills/hookcode-pat-api-debug/scripts/pat_request.mjs`

## Visual/Browser Findings
- None.
