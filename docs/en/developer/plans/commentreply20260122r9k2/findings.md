# Findings & Decisions: Reply to triggering webhook comment
{/* Stores discoveries and decisions for this session. commentreply20260122r9k2 */}

## Session Metadata
- **Session Hash:** commentreply20260122r9k2
- **Created:** 2026-01-22

## Requirements
- When a job is triggered by a GitHub/GitLab comment webhook, the final response posted back should clearly point to the triggering comment.
- Prefer native threaded reply APIs when available (so the response appears under the original comment).
- Provide a consistent fallback for event types that do not support threaded replies (e.g., include a backlink/quote in the posted body).

## Research Findings
- The backend already distinguishes `issue_comment` and GitLab `note` webhooks in `backend/src/modules/webhook/webhook.handlers.ts`.
- GitLab integration already has an API surface that accepts `discussion_id` when posting (`backend/src/modules/git-providers/gitlab.service.ts`), and prompt/report code already extracts `discussion_id`.
- There are existing unit tests around webhook meta + prompt/report extraction (`backend/src/tests/unit/*`), which can be extended for trigger-context propagation and posting behavior.
- Current posting logic (`backend/src/agent/reporter.ts`) already replies to GitLab discussions when `discussion_id` exists, but it does not add a backlink to the triggering note/comment.
- GitHub posting logic currently posts only when `task.issueId` exists; GitHub PR tasks use `task.mrId` (PR number) in `buildGithubTaskMeta`, so `postToProvider` should treat `mrId` as an issue-number-like target for PR conversations.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Introduce a minimal "triggerContext" object (platform + comment identifiers + url) | Keeps the queue payload small and avoids storing full webhook payloads while enabling reply/backlink. |
| Always include a "Triggered by" backlink line in the posted body (even when threading works) | Provides a stable, cross-platform reference and helps when UIs collapse threads or when permissions hide the original. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- Webhook handler: `backend/src/modules/webhook/webhook.handlers.ts`
- GitLab client/service: `backend/src/modules/git-providers/gitlab.service.ts`
- Prompt/Reporter context extraction: `backend/src/agent/promptBuilder.ts`, `backend/src/agent/reporter.ts`
