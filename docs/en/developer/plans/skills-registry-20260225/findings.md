# Findings & Decisions: skills registry + prompt text

## Session Metadata
- **Session Hash:** skills-registry-20260225
- **Created:** 2026-02-25

## Requirements
- Provide a web UI that lists skills split into built-in vs extra.
- Extra skills are globally shared and can be enabled/disabled from UI.
- Each skill can include custom prompt text, with its own enable toggle.
- Prompt text should be prepended to the prompt when enabled.
- Apply enabled extra skills to newly created task groups.
- Skills need tag metadata for management and filtering in the UI.
<!-- Capture tag management requirement for skills. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Skills page styling should match the existing console theme palette.
<!-- Capture the requirement to align Skills page styling with the app theme. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Skill defaults must be configurable per repository and overrideable per task-group conversation.
<!-- Capture repo/task-group skill selection requirements. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Skill selection UI should live in the repo detail dashboard and the chat composer action area for task groups.
<!-- Capture selection UI placement requirement. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Skills page UI should follow the SkillsMP marketplace layout and terminal-like aesthetic.
<!-- Capture SkillsMP reference requirement for the registry UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Built-in skills must include hookcode-pat-api-debug, hookcode-yml-generator, and hookcode-preview-highlight.
<!-- Capture explicit built-in skill list requirement. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Built-in skills must move to a backend-managed folder with base + provider-specific overrides (.codex/.claude/.gemini).
<!-- Capture built-in skill relocation and override structure. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- Extra skills must support archive uploads, validate the bundle structure, and persist to a git-ignored server storage folder.
<!-- Capture extra skill upload + storage requirement. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->

## Research Findings
- Built-in skills are seeded into task-group workspaces from `backend/src/agent/example/.codex/skills` (plus `.claude`/`.gemini`).
- Task-group layout is created in `backend/src/agent/agent.ts` via `ensureTaskGroupLayout()`.
- Prompt content is built in `backend/src/agent/promptBuilder.ts` and written to `.codex_prompt.txt` in `agent.ts`.
- Skill registry can scan built-ins from the agent example folder and load extra skills from the DB.
- Prompt prefix ordering should be deterministic (built-in then extra, sorted by name).

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Store extra skills in a new DB table with metadata + prompt text + enabled flag | Supports global listing and toggles without filesystem scanning. |
| Parse built-in skill metadata (including prompt text) from `SKILL.md` frontmatter | Keeps built-in skills self-contained. |
| Prepend enabled skill prompt text before the rendered prompt | Aligns with requirement for strong, front-loaded instructions. |
| Inject enabled extra skills into new task-group `.codex/.claude/.gemini` | Ensures skills are available at execution time. |
| Store skill tags in built-in frontmatter + extra-skill DB rows | Enables tag-based filtering and categorization in the console. |
<!-- Record tag storage decision for the skills registry. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| None | N/A |

## Resources
- `backend/src/agent/agent.ts`
- `backend/src/agent/promptBuilder.ts`
- `backend/src/agent/example/.codex/skills/`
- `frontend/src/pages/SkillsPage.tsx`

## Visual/Browser Findings
- None
