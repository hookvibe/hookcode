import type { FC } from 'react';
import type { Task } from '../../api';
import { useT } from '../../i18n';
import { ApprovalRequestPanel } from './ApprovalRequestPanel';

type ExecutionApprovalBannerProps = {
  task: Task;
  context?: 'log' | 'chat';
  onUpdated?: (task: Task) => void | Promise<void>;
};

export const ExecutionApprovalBanner: FC<ExecutionApprovalBannerProps> = ({
  task,
  context = 'log',
  onUpdated
}) => {
  const t = useT();

  if (!task.approvalRequest) return null;

  return (
    <section className={`hc-execution-approval hc-execution-approval--${context}`} aria-label={t('approval.title')}>
      <div className="hc-execution-approval__strap">
        <span className="hc-execution-approval__eyebrow">{t('approval.title')}</span>
        {task.status === 'waiting_approval' ? (
          <span className="hc-execution-approval__state">{t('task.status.waiting_approval')}</span>
        ) : null}
      </div>
      <ApprovalRequestPanel
        approval={task.approvalRequest}
        task={task}
        variant="compact"
        canManage={Boolean(task.permissions?.canManage)}
        onUpdated={() => onUpdated?.(task)}
      />
    </section>
  );
};
