import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { db } from '../../db';

type DashboardSidebarToken = {
  token: string;
  hasActiveTasks: boolean;
};

/**
 * DashboardSidebarTokenService:
 * - Business context: Backend / Dashboard sidebar notifications.
 * - Purpose: compute a stable "change token" for the sidebar without being triggered by high-frequency log writes.
 * - Change record: used by Route A SSE producer to avoid client polling. kxthpiu4eqrmu0c6bboa
 */
@Injectable()
export class DashboardSidebarTokenService {
  async computeToken(options: { tasksLimit: number; taskGroupsLimit: number }): Promise<DashboardSidebarToken> {
    const tasksLimit = Math.min(Math.max(Math.floor(options.tasksLimit), 1), 20);
    const taskGroupsLimit = Math.min(Math.max(Math.floor(options.taskGroupsLimit), 1), 200);

    // Token design: include counts + membership of top-N ids, but exclude updatedAt/output/logs to avoid noise. kxthpiu4eqrmu0c6bboa
    const [taskRow] = await db.$queryRaw<any[]>`
      WITH base AS (
        SELECT id::text AS id,
               status,
               updated_at,
               COUNT(*) OVER (PARTITION BY status) AS status_count,
               ROW_NUMBER() OVER (PARTITION BY status ORDER BY updated_at DESC) AS rn
        FROM tasks
        WHERE status IN ('queued', 'processing', 'succeeded', 'commented', 'failed')
      ),
      counts AS (
        SELECT status, MAX(status_count)::int AS cnt
        FROM base
        GROUP BY status
      ),
      top_ids AS (
        SELECT status, ARRAY_AGG(id ORDER BY rn) AS ids
        FROM base
        WHERE rn <= ${tasksLimit}
        GROUP BY status
      ),
      success_base AS (
        SELECT id::text AS id,
               ROW_NUMBER() OVER (ORDER BY updated_at DESC) AS rn
        FROM tasks
        WHERE status IN ('succeeded', 'commented')
      ),
      success_top AS (
        SELECT ARRAY_AGG(id ORDER BY rn) AS ids
        FROM success_base
        WHERE rn <= ${tasksLimit}
      )
      SELECT
        COALESCE((SELECT cnt FROM counts WHERE status = 'queued'), 0) AS queued_count,
        COALESCE((SELECT cnt FROM counts WHERE status = 'processing'), 0) AS processing_count,
        COALESCE((SELECT cnt FROM counts WHERE status = 'failed'), 0) AS failed_count,
        COALESCE((SELECT cnt FROM counts WHERE status = 'succeeded'), 0)
          + COALESCE((SELECT cnt FROM counts WHERE status = 'commented'), 0) AS success_count,
        COALESCE((SELECT ids FROM top_ids WHERE status = 'queued'), ARRAY[]::text[]) AS queued_ids,
        COALESCE((SELECT ids FROM top_ids WHERE status = 'processing'), ARRAY[]::text[]) AS processing_ids,
        COALESCE((SELECT ids FROM top_ids WHERE status = 'failed'), ARRAY[]::text[]) AS failed_ids,
        COALESCE((SELECT ids FROM success_top), ARRAY[]::text[]) AS success_ids
    `;

    const [groupRow] = await db.$queryRaw<any[]>`
      SELECT COALESCE(ARRAY_AGG(id::text ORDER BY updated_at DESC), ARRAY[]::text[]) AS group_ids
      FROM (
        SELECT id, updated_at
        FROM task_groups
        ORDER BY updated_at DESC
        LIMIT ${taskGroupsLimit}
      ) g
    `;

    const queuedCount = Number(taskRow?.queued_count ?? 0) || 0;
    const processingCount = Number(taskRow?.processing_count ?? 0) || 0;
    const successCount = Number(taskRow?.success_count ?? 0) || 0;
    const failedCount = Number(taskRow?.failed_count ?? 0) || 0;

    const queuedIds = Array.isArray(taskRow?.queued_ids) ? taskRow.queued_ids.map(String) : [];
    const processingIds = Array.isArray(taskRow?.processing_ids) ? taskRow.processing_ids.map(String) : [];
    const successIds = Array.isArray(taskRow?.success_ids) ? taskRow.success_ids.map(String) : [];
    const failedIds = Array.isArray(taskRow?.failed_ids) ? taskRow.failed_ids.map(String) : [];
    const groupIds = Array.isArray(groupRow?.group_ids) ? groupRow.group_ids.map(String) : [];

    const source = [
      `q:${queuedCount}:${queuedIds.join(',')}`,
      `p:${processingCount}:${processingIds.join(',')}`,
      `s:${successCount}:${successIds.join(',')}`,
      `f:${failedCount}:${failedIds.join(',')}`,
      `g:${groupIds.join(',')}`
    ].join('|');

    const token = createHash('sha1').update(source).digest('hex');
    return { token, hasActiveTasks: queuedCount > 0 || processingCount > 0 };
  }
}
