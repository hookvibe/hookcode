# Findings & Decisions: frontend-page-folder-refactor-20260305

## Requirements
- User asks to refactor frontend project directory so each standalone page (different route target) has its own folder.
- If pages are in a containment relationship, directory structure must also be nested.
- Implement directly in project codebase (not only provide a plan).
- Follow-up request: create a `.pen` file under each page folder, and name each `.pen` file after its page.

## Research Findings
- Current page modules are mostly flat under `frontend/src/pages/*.tsx`.
- Existing helper subfolder already exists (`frontend/src/pages/tasks/*`), showing folder-based page organization is already acceptable.
- Router and test files likely import page modules directly by old flat paths, so imports must be updated after moves.
- `router.ts` route pages include: `home`, `tasks`, `task`, `taskGroups`, `taskGroup`, `repos`, `repo`, `archive`, `skills`, `settings`, and auth pages.
- Containment relations inferred from routes:
  - `tasks` contains `task` (`#/tasks` and `#/tasks/:taskId`).
  - `repos` contains `repo` (`#/repos` and `#/repos/:repoId[/tab]`).
  - `taskGroups` contains `taskGroup` (`#/task-groups` and `#/task-groups/:taskGroupId`).
- `AppShell.tsx` currently imports all page entries from flat `./<PageName>` paths, so this file is the primary import-update point.
- Direct page imports in tests currently target flat paths:
  - `reposPage.test.tsx`, `repoDetailPage.test.tsx`
  - `tasksPage.test.tsx`, `taskDetailPage.test.tsx`
  - `taskGroupsPage.test.tsx`, `taskGroupChatPageTestUtils.tsx`
  - `archivePage.test.tsx`, `skillsPage.test.tsx`
- Refactor implementation confirmed with final structure:
  - `pages/tasks/TasksPage.tsx` and nested `pages/tasks/task/TaskDetailPage.tsx`
  - `pages/repos/ReposPage.tsx` and nested `pages/repos/repo/RepoDetailPage.tsx`
  - `pages/taskGroups/TaskGroupsPage.tsx` and nested `pages/taskGroups/taskGroup/TaskGroupChatPage.tsx`
  - standalone folders for `archive`, `skills`, `settings`
  - auth folders under `pages/auth/{login,register,verifyEmail,acceptInvite}`
- Validation result: frontend test suite and build both pass after path updates.
- `.pen` scaffolding created for each page folder, named after its page file (`<PageName>.pen`).

## Technical Decisions
| Decision | Rationale |
|---|---|
| Refactor only route-level page files into page-owned folders | Meets request while avoiding broad unrelated component churn. |
| Keep support/helper files in subfolders under their owning page folder | Preserves separation of route entry vs helper logic. |
| Update imports with minimal path churn | Reduce regression risk and keep review clear. |
| Use nested directories `tasks/task`, `repos/repo`, `taskGroups/taskGroup` | Implements "containment relation = nested structure" from user requirement. |
| Move auth pages under `pages/auth/<page>/` | Keeps auth-related route pages grouped while still preserving one-folder-per-page. |
| Keep `AppShell` in `pages/appShell/AppShell.tsx` | Aligns shell entry with existing `pages/appShell/sidebarConstants.ts` module grouping. |
| Create `.pen` files only for folders that contain route entry page files (`*Page.tsx` or `AppShell.tsx`) | Matches "each page folder" and avoids generating files for helper-only folders like `pages/tasks` helpers or grouping-only `pages/auth`. |
| Keep generated `.pen` files as empty placeholders | User requested file scaffolding only, so avoid injecting unverified `.pen` schema content. |

## Issues Encountered
| Issue | Resolution |
|---|---|
| Session init script failed docs navigation sync step | Continue because planning files were created; track in plan/progress error logs. |

## Resources
- `frontend/src/router.ts`
- `frontend/src/App.tsx`
- `frontend/src/pages/*.tsx`
- `frontend/src/tests/*.test.tsx`
- `docs/en/developer/plans/frontend-page-folder-refactor-20260305/task_plan.md`
