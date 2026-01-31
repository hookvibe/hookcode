-- Add robot time window columns for hour-level scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
ALTER TABLE "repo_robots"
ADD COLUMN "time_window_start_hour" INT,
ADD COLUMN "time_window_end_hour" INT;
