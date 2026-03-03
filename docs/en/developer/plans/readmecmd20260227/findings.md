# Findings & Decisions: Rewrite README command presentation

## Session Metadata
- **Session Hash:** readmecmd20260227
- **Created:** 2026-02-27

## Requirements
- Rewrite both `README.md` and `README-zh-CN.md` because current content is too minimal.
- Improve command presentation so startup and maintenance commands are easier to use.
- Keep command guidance practical for Docker and local development workflows.

## Research Findings
- Existing README files already include required workflows, but command presentation is compact and mixed with prose.
- Docker workflow requires `docker/.env` (copied from `docker/.env.example`) before `docker compose up`.
- Current Docker compose mode does not provide hot reload for frontend/backend source changes.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Reorganize quick-start into command-first subsections | Makes daily operations easier to execute without scanning long paragraphs |
| Add operational command blocks (`ps`, `logs`, `restart`, `stop`) | Improves troubleshooting and repeatability |
| Explicitly document rebuild requirement after code changes in Docker mode | Aligns docs with actual container behavior |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Initial `docker compose build` failed pulling `node:18-alpine` from mirror with EOF | Verified daemon mirror settings and revalidated pull with `docker pull node:18-alpine`; issue is intermittent mirror/network side |

## Resources
- `README.md`
- `README-zh-CN.md`
- `docker/docker-compose.yml`
- `docker/.env.example`

## Visual/Browser Findings
- N/A for this task.