# Findings & Decisions: Show bound AI for robot display
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. rbtaidisplay20260128 */}

## Session Metadata
- **Session Hash:** rbtaidisplay20260128
- **Created:** 2026-01-28

## Requirements
- Show the robot's bound AI (codex/claude/gemini) anywhere the robot is displayed in the frontend (e.g., task group selector, task detail list, task detail page).
- UI must be concise, aligned, and not overflow the container.
- Placement should be reasonable and visually clean.
- Add/update frontend tests to cover provider label display.

## Research Findings
- Task group chat robot picker uses `robotOptions` with label `r.name || r.id` in `frontend/src/pages/TaskGroupChatPage.tsx`.
- Task detail page builds `robotSummary` from task payload only and has no provider mapping (`frontend/src/pages/TaskDetailPage.tsx`).
- Tasks list page (`frontend/src/pages/TasksPage.tsx`) does not currently render robot info.
- Task group chat item cards do not show robot info (`frontend/src/components/chat/TaskConversationItem.tsx`).
- Automation rule robot selector (`frontend/src/components/repoAutomation/TriggerRuleModal.tsx`) composes option labels with status badge + permission badge + name.
- Repo onboarding wizard builds `robotOptions` from `r.name || r.id` (`frontend/src/components/repos/RepoOnboardingWizard.tsx`).
- Repo detail dashboard summary shows default robot name without provider (`frontend/src/components/repos/RepoDetailDashboardSummaryStrip.tsx`).
- Repo detail robots table name column currently shows name + id only (`frontend/src/pages/RepoDetailPage.tsx`).
- Repo automation panel summary does not render robot names except mention tags (`frontend/src/components/repoAutomation/RepoAutomationPanel.tsx`).
- Frontend already has `listRepoRobots(repoId)` in `frontend/src/api.ts` and uses it in TaskGroupChatPage.
- Backend `TaskRobotSummary` does not include `modelProvider` (`backend/src/types/task.ts`), so task payloads currently lack bound AI info.
- TaskDetailPage tests override `fetchTask` multiple times, so provider coverage should rely on a separate robot lookup mock (`frontend/src/tests/taskDetailPage.test.tsx`).
- Frontend package has `test` script (`vitest run`) in `frontend/package.json`; root package uses workspace filtering.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Prefer frontend mapping via repo robots list when task payload lacks provider | Avoid backend changes while still showing bound AI on task pages |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `frontend/package.json`
- `package.json`
- `frontend/src/api.ts`
- `frontend/src/pages/TaskGroupChatPage.tsx`
- `frontend/src/pages/TaskDetailPage.tsx`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/components/chat/TaskConversationItem.tsx`
- `frontend/src/components/repoAutomation/TriggerRuleModal.tsx`
- `frontend/src/components/repoAutomation/RepoAutomationPanel.tsx`
- `frontend/src/components/repos/RepoOnboardingWizard.tsx`
- `frontend/src/components/repos/RepoDetailDashboardSummaryStrip.tsx`
- `frontend/src/pages/RepoDetailPage.tsx`
- `frontend/src/tests/taskGroupChatPage.test.tsx`
- `frontend/src/tests/taskDetailPage.test.tsx`
- `backend/src/types/task.ts`

## Visual/Browser Findings
- Not applicable (no images or browser content reviewed).
