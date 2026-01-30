# Findings & Decisions: PAT API debug skill
<!-- Capture skill requirements and discoveries for this session. docs/en/developer/plans/open-api-pat-skill-20260130/task_plan.md open-api-pat-skill-20260130 -->

## Session Metadata
- **Session Hash:** open-api-pat-skill-20260130
- **Created:** 2026-01-30

## Requirements
- Create a new skill under `.codex/skills` for PAT-authenticated backend API requests used for debugging.
- Provide a JS request script that can call backend endpoints (method, path, optional JSON body) and print results.
- Include an env template containing backend base URL and PAT placeholders.
- Keep the skill self-contained and directly usable from the repo workspace.

## Research Findings
- Existing session `open-api-pat-design` is complete; this request is a follow-on skill to use PATs for debugging.
- User docs show PAT requests use `Authorization: Bearer <PAT>` and the base URL is the HookCode server or credential profile API base URL.
- Existing skills under `.codex/skills/` use a single `SKILL.md` plus optional `references/` and `assets/` directories; follow the same structure.
- The skill-creator tooling lives under `/Users/gaoruicheng/.codex/skills/.system/skill-creator/scripts`, but `init_skill.py` was not found via a repo-wide search yet.
- `init_skill.py` exists at `/Users/gaoruicheng/.codex/skills/.system/skill-creator/scripts/init_skill.py` and requires `--path` plus optional `--resources` and `--examples`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Skill name `hookcode-pat-api-debug` with `scripts/` only | Keeps the skill focused and consistent with existing skill layout |
| Env keys `HOOKCODE_API_BASE_URL` + `HOOKCODE_PAT` | Straightforward configuration and aligns with PAT usage docs |
| Use `Authorization: Bearer <PAT>` | Matches documented PAT usage and backend tests |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| package_skill.py required PyYAML but system pip was locked | Installed PyYAML inside a temporary venv under /tmp |

## Resources
- `docs/en/developer/plans/open-api-pat-design/task_plan.md` for prior PAT feature context.
- `docs/en/user-docs/features.md` for PAT usage header and base URL guidance.
