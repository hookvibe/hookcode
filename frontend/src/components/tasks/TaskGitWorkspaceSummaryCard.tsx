import { ArrowRightOutlined, DiffOutlined, FileTextOutlined } from '@ant-design/icons';
import { Button, Tag, Typography } from 'antd';
import { useMemo, type FC } from 'react';
import type { Task } from '../../api';
import { useLocale, useT } from '../../i18n';
import { calculateUnifiedDiffStats } from '../diff/calculateDiff';
import '../../styles/task-git-workspace.css';

interface TaskGitWorkspaceSummaryCardProps {
  task: Task;
  onOpen?: (task: Task) => void;
  actionLabel?: string;
}

const pushLabelKeyByStatus: Record<string, string> = {
  pushed: 'tasks.gitStatus.push.pushed',
  unpushed: 'tasks.gitStatus.push.unpushed',
  error: 'tasks.gitStatus.push.error',
  not_applicable: 'tasks.gitStatus.push.notApplicable',
  unknown: 'tasks.gitStatus.push.unknown'
};

const pushColorByStatus: Record<string, string | undefined> = {
  pushed: 'green',
  unpushed: 'orange',
  error: 'red',
  not_applicable: undefined,
  unknown: undefined
};

const formatCompactPath = (rawPath: string, maxSegments: number = 3): string => {
  const normalizedPath = String(rawPath ?? '').trim();
  if (!normalizedPath) return normalizedPath;
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  if (segments.length <= maxSegments) return normalizedPath;
  return `.../${segments.slice(-maxSegments).join('/')}`;
};

const formatSha = (rawSha?: string): string => {
  const normalizedSha = String(rawSha ?? '').trim();
  return normalizedSha ? normalizedSha.slice(0, 8) : '-';
};

export const TaskGitWorkspaceSummaryCard: FC<TaskGitWorkspaceSummaryCardProps> = ({ task, onOpen, actionLabel }) => {
  const locale = useLocale();
  const t = useT();

  const view = useMemo(() => {
    const gitStatus = task.result?.gitStatus;
    const workspaceChanges = task.result?.workspaceChanges;
    const files = workspaceChanges?.files ?? [];
    const workingTree = gitStatus?.workingTree ?? { staged: [], unstaged: [], untracked: [] };
    const totalFileCount = new Set([
      ...workingTree.staged,
      ...workingTree.unstaged,
      ...workingTree.untracked,
      ...files.map((file) => file.path)
    ]).size;
    const diffStats = files.reduce(
      (acc, file) => {
        const next = calculateUnifiedDiffStats(file.unifiedDiff ?? '');
        acc.additions += next.additions;
        acc.deletions += next.deletions;
        return acc;
      },
      { additions: 0, deletions: 0 }
    );
    const recentFiles = Array.from(new Set([
      ...files.map((file) => file.path),
      ...workingTree.staged,
      ...workingTree.unstaged,
      ...workingTree.untracked
    ])).slice(0, 3);
    const branch = gitStatus?.final?.branch ?? gitStatus?.baseline?.branch ?? '';
    const headSha = gitStatus?.final?.headSha ?? gitStatus?.baseline?.headSha ?? '';
    const pushStatus = gitStatus?.push?.status ?? 'unknown';
    const capturedAt = workspaceChanges?.capturedAt ?? gitStatus?.capturedAt ?? task.updatedAt ?? '';

    return {
      branch,
      headSha,
      pushStatus,
      capturedAt,
      totalFileCount,
      additions: diffStats.additions,
      deletions: diffStats.deletions,
      recentFiles,
      stagedCount: workingTree.staged.length,
      unstagedCount: workingTree.unstaged.length,
      untrackedCount: workingTree.untracked.length,
      hasSnapshot: files.length > 0
    };
  }, [task]);

  if (
    !task.result?.gitStatus?.enabled &&
    !task.result?.workspaceChanges?.files?.length &&
    !task.result?.gitStatus?.workingTree?.staged?.length &&
    !task.result?.gitStatus?.workingTree?.unstaged?.length &&
    !task.result?.gitStatus?.workingTree?.untracked?.length
  ) {
    return null;
  }

  const numberFormatter = new Intl.NumberFormat(locale);
  const pushKey = pushLabelKeyByStatus[view.pushStatus] ?? 'tasks.gitStatus.push.unknown';
  const pushColor = pushColorByStatus[view.pushStatus];
  const totalChangedLines = view.additions + view.deletions;
  const openLabel = actionLabel ?? t('tasks.gitWorkspace.summary.open');

  return (
    <section className="hc-git-workspace-summary" aria-label={t('tasks.workspaceChanges.title')}>
      <div className="hc-git-workspace-summary__header">
        <div className="hc-git-workspace-summary__intro">
          <div className="hc-git-workspace-summary__eyebrow">{t('tasks.gitWorkspace.eyebrow')}</div>
          <div className="hc-git-workspace-summary__title-row">
            <Typography.Text strong className="hc-git-workspace-summary__title">
              {view.branch || '-'}
            </Typography.Text>
            <Tag color={task.status === 'processing' ? 'blue' : undefined}>{t(task.status === 'processing' ? 'tasks.gitWorkspace.live' : 'tasks.gitWorkspace.snapshot')}</Tag>
            <Tag color={view.totalFileCount > 0 ? 'volcano' : 'green'}>{t(view.totalFileCount > 0 ? 'tasks.gitStatus.dirty' : 'tasks.gitStatus.clean')}</Tag>
            <Tag color={pushColor}>{t(pushKey)}</Tag>
          </div>
          <div className="hc-git-workspace-summary__meta">
            <span>{`${t('tasks.gitStatus.commit')}: ${formatSha(view.headSha)}`}</span>
            {view.capturedAt ? (
              <span>
                {t('tasks.workspaceChanges.updatedAt', {
                  value: new Date(view.capturedAt).toLocaleTimeString(locale)
                })}
              </span>
            ) : null}
          </div>
        </div>

        {onOpen ? (
          <Button
            size="small"
            type="default"
            icon={<ArrowRightOutlined />}
            className="hc-git-workspace-summary__action"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpen(task);
            }}
          >
            {openLabel}
          </Button>
        ) : null}
      </div>

      <div className="hc-git-workspace-summary__stats">
        <div className="hc-git-workspace-summary__stat">
          <span className="hc-git-workspace-summary__stat-label">
            <FileTextOutlined />
            {t('tasks.gitStatus.files')}
          </span>
          <strong>{numberFormatter.format(view.totalFileCount)}</strong>
        </div>
        <div className="hc-git-workspace-summary__stat">
          <span className="hc-git-workspace-summary__stat-label">
            <DiffOutlined />
            {t('tasks.gitWorkspace.section.lines')}
          </span>
          <strong>{numberFormatter.format(totalChangedLines)}</strong>
        </div>
        <div className="hc-git-workspace-summary__stat">
          <span className="hc-git-workspace-summary__stat-label">{t('tasks.gitWorkspace.section.staged')}</span>
          <strong>{numberFormatter.format(view.stagedCount)}</strong>
        </div>
        <div className="hc-git-workspace-summary__stat">
          <span className="hc-git-workspace-summary__stat-label">{t('tasks.gitWorkspace.section.unstaged')}</span>
          <strong>{numberFormatter.format(view.unstagedCount + view.untrackedCount)}</strong>
        </div>
      </div>

      <div className="hc-git-workspace-summary__sections">
        {view.stagedCount > 0 ? <span className="hc-git-workspace__section-pill hc-git-workspace__section-pill--staged">{t('tasks.gitStatus.files.staged', { count: view.stagedCount })}</span> : null}
        {view.unstagedCount > 0 ? <span className="hc-git-workspace__section-pill hc-git-workspace__section-pill--unstaged">{t('tasks.gitStatus.files.unstaged', { count: view.unstagedCount })}</span> : null}
        {view.untrackedCount > 0 ? <span className="hc-git-workspace__section-pill hc-git-workspace__section-pill--untracked">{t('tasks.gitStatus.files.untracked', { count: view.untrackedCount })}</span> : null}
        {!view.hasSnapshot && view.totalFileCount === 0 ? <span className="hc-git-workspace__section-pill">{t('tasks.gitWorkspace.empty')}</span> : null}
      </div>

      {view.recentFiles.length ? (
        <div className="hc-git-workspace-summary__files">
          {view.recentFiles.map((path) => (
            <span key={path} className="hc-git-workspace-summary__file" title={path}>
              {formatCompactPath(path)}
            </span>
          ))}
          {view.totalFileCount > view.recentFiles.length ? (
            <span className="hc-git-workspace-summary__more">
              {t('tasks.gitWorkspace.summary.more', { count: view.totalFileCount - view.recentFiles.length })}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
