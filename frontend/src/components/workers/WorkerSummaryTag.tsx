import { FC } from 'react';
import { Space, Tag, Tooltip, Typography } from 'antd';
import type { WorkerSummary } from '../../api';
import { useT } from '../../i18n';
import { getWorkerKindLabel, getWorkerStatusColor, getWorkerStatusLabel } from '../../utils/workers';

interface WorkerSummaryTagProps {
  worker?: WorkerSummary | null;
  workerId?: string | null;
  bordered?: boolean;
}

export const WorkerSummaryTag: FC<WorkerSummaryTagProps> = ({ worker, workerId, bordered = true }) => {
  const t = useT();

  if (!worker && !workerId) return null;
  if (!worker) {
    // Fall back to the raw worker id when summary metadata is unavailable so attribution still remains visible. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    return <Tag style={{ marginInlineEnd: 0 }}>{workerId || t('workers.common.unknown')}</Tag>;
  }

  const tooltip = (
    <Space size={6} wrap>
      <Typography.Text>{worker.name}</Typography.Text>
      <Typography.Text type="secondary">{getWorkerKindLabel(t, worker.kind)}</Typography.Text>
      <Typography.Text type="secondary">{getWorkerStatusLabel(t, worker.status)}</Typography.Text>
    </Space>
  );

  return (
    <Tooltip title={tooltip}>
      {/* Render a compact worker attribution tag so task, group, and robot views stay aligned. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
      <Tag color={getWorkerStatusColor(worker.status)} bordered={bordered} style={{ marginInlineEnd: 0 }}>
        {worker.name}
      </Tag>
    </Tooltip>
  );
};
