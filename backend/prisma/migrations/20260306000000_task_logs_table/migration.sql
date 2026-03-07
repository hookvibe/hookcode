-- Create task logs table for paged execution log access. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
CREATE TABLE "task_logs" (
    "id" uuid NOT NULL,
    "task_id" uuid NOT NULL,
    "seq" integer NOT NULL,
    "line" text NOT NULL,
    "created_at" timestamptz(6) NOT NULL DEFAULT now(),

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "task_logs_task_id_seq_unique" ON "task_logs"("task_id", "seq");
CREATE INDEX "task_logs_task_id_seq_idx" ON "task_logs"("task_id", "seq");
CREATE INDEX "task_logs_task_id_created_at_idx" ON "task_logs"("task_id", "created_at");

-- Backfill log lines from tasks.result_json into task_logs. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
WITH source AS (
    SELECT
        t.id AS task_id,
        t.updated_at AS created_at,
        COALESCE((t.result_json->>'logsSeq')::int, 0) AS logs_seq,
        t.result_json->'logs' AS logs
    FROM tasks t
    WHERE jsonb_typeof(t.result_json->'logs') = 'array'
)
INSERT INTO task_logs ("id", "task_id", "seq", "line", "created_at")
SELECT
    md5(random()::text || clock_timestamp()::text || s.task_id::text || ordinality::text)::uuid AS id,
    s.task_id,
    CASE
        WHEN s.logs_seq > 0 THEN s.logs_seq - jsonb_array_length(s.logs) + ordinality
        ELSE ordinality
    END AS seq,
    log_line,
    s.created_at
FROM source s
CROSS JOIN LATERAL jsonb_array_elements_text(s.logs) WITH ORDINALITY AS log_entry(log_line, ordinality);

-- Strip log payloads from result_json after backfill to reduce task row size. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
UPDATE tasks
SET result_json = CASE
    WHEN result_json IS NULL THEN NULL
    ELSE result_json - 'logs' - 'logsSeq'
END
WHERE result_json ? 'logs' OR result_json ? 'logsSeq';
