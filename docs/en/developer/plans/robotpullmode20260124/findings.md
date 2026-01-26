# Findings: Robot pull mode control (direct vs fork)

## 2026-01-24
- Repo robots are stored in backend/src/modules/repositories/repo-robot.service.ts and modelProviderConfig is normalized/merged per provider; no existing pull-mode field.
- Robot UI is in frontend/src/pages/RepoDetailPage.tsx with robot form modal and actions for test/enable/delete.
- task_plan.md shows Phase 2 still in_progress and Phase 3 pending even though backend field + endpoint work are already underway; phase status needs refresh after UI/test work.
- backend/src/agent/agent.ts already binds repo workspace to taskGroupId, skips git pull when workspace exists, and emits ThoughtChain log entries for clone/reuse, satisfying the task-group pull-once requirement.
- frontend/src/pages/RepoDetailPage.tsx already has handleTestRobot and robot modal sections; workflow mode UI can be added alongside credentials/model cards with a new handler similar to handleTestRobot.
- i18n keys for workflow mode + check button already exist in zh-CN and en-US message files.
- frontend/src/api.ts already exports testRepoRobotWorkflow(repoId, robotId, { mode }) returning  ok, mode, robot?, message?  for UI check integration.
- repositories.controller.ts has testRobotWorkflow endpoint that relies on RepositoryService, RepoRobotService, UserService, and GitHub/GitLab services; tests can mock these services similar to existing repo webhook/archived API tests.
- backend/src/services/repoWorkflowMode.ts exposes normalize/resolve helpers suitable for unit tests without mocking provider APIs.
- progress.md is still template and needs updating with actions/tests after UI + test additions.
