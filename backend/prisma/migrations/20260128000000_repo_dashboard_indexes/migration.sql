-- Add repo dashboard indexes for task, task group, and webhook delivery queries. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
CREATE INDEX IF NOT EXISTS tasks_repo_status_updated_at_idx ON tasks (repo_id, status, updated_at);
CREATE INDEX IF NOT EXISTS tasks_repo_created_at_idx ON tasks (repo_id, created_at);
CREATE INDEX IF NOT EXISTS tasks_repo_archived_at_idx ON tasks (repo_id, archived_at);

CREATE INDEX IF NOT EXISTS task_groups_repo_commit_archived_idx ON task_groups (repo_id, commit_sha, archived_at);
CREATE INDEX IF NOT EXISTS task_groups_repo_mr_archived_idx ON task_groups (repo_id, mr_id, archived_at);
CREATE INDEX IF NOT EXISTS task_groups_repo_issue_archived_idx ON task_groups (repo_id, issue_id, archived_at);

CREATE INDEX IF NOT EXISTS repo_webhook_deliveries_repo_created_id_idx ON repo_webhook_deliveries (repo_id, created_at, id);
