# Task Plan: skills registry + prompt text

## Session Metadata
- **Session Hash:** skills-registry-20260225
- **Created:** 2026-02-25

## Goal
Deliver a skills registry (built-in + extra) with a console page, enable/disable controls, prompt-text injection per skill for new task groups, per-repo + per-task-group skill selection, and a Skills UI aligned to the SkillsMP-style marketplace layout.
<!-- Extend the skills registry goal to include selection scopes and marketplace-style UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->

## Current Phase
Phase 5
<!-- Move to delivery after completing verification and fixes. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Identify backend/frontend touch points
- [x] Decide data model for extra skills and prompt text
- **Status:** complete

### Phase 3: Implementation
- [x] Add extra skills data model + migrations
- [x] Build skills registry service (built-in scanning + extra DB)
- [x] Extend prompt building to prepend enabled skill prompt text
- [x] Inject enabled extra skills into new task-group workspaces
- [x] Add skills API endpoints + Swagger DTOs
- [x] Build frontend Skills page + API client + sidebar link
- [x] Update i18n strings and styling
- [x] Add skill tags with API + UI filtering support
<!-- Track tag filtering work in the implementation phase. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- [x] Add repo-level default skill selection storage + APIs
- [x] Add task-group-level skill selection storage + APIs
- [x] Apply repo defaults to new task groups and filter prompts by selected skills
- [x] Sync selected extra skills into task-group workspaces
- [x] Expand built-in skill registry to include HookCode bundled skills
- [x] Add repo-level skill selection UI in repo detail dashboard
- [x] Add task-group skill selection UI in the chat composer
- [x] Build a shared selection panel with tags + search filtering
- [x] Redesign Skills page to match SkillsMP-style marketplace layout
<!-- Track selection + UI redesign work in implementation. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- **Status:** complete
<!-- Close implementation after the SkillsMP-style layout work landed. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->

### Phase 4: Testing & Verification
- [x] Add/update unit tests for skills registry + prompt injection
- [x] Run full test suite and record results
- [x] Fix any issues found
<!-- Close verification after the latest test run and fixes. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->
- **Status:** complete

### Phase 5: Delivery
- [x] Update progress.md and changelog entry
- [x] Summarize changes for user
- **Status:** complete
<!-- Mark delivery complete after updating logs and final response. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 -->

## Key Questions
1. Where to store extra skill metadata and prompt text? (Answer: new DB table + storage path; built-ins read from SKILL.md frontmatter.)
2. How to inject skill prompt text? (Answer: prepend enabled skill text before existing prompt template.)
3. How to apply extra skills to task groups? (Answer: copy enabled extra skills into .codex/.claude/.gemini when creating new task group workspaces.)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Store extra skills in DB with storagePath + promptText + promptEnabled | Allows global enable/disable and prompt injection without touching built-in files. |
| Read built-in skill prompt text from SKILL.md frontmatter | Keeps built-ins self-describing without extra DB rows. |
| Prepend enabled skill prompt text | Aligns with requirement for strong, front-loaded instructions. |
| Prompt prefix order = built-in then extra, sorted by name | Ensures stable prompt ordering for reproducible runs. |
| Apply extra skills only on new task-group creation | Avoids retroactive mutation of existing task groups. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None | 1 | N/A |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
