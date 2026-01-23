import { FC, useMemo } from 'react';
import { Card, Divider, Space, Tag, Typography } from 'antd';
import type { Task } from '../../api';
import { useT } from '../../i18n';

interface TaskGitStatusPanelProps {
  task?: Task | null;
  variant?: 'compact' | 'full';
}

const normalizeWebBase = (value: string): string => {
  // Normalize repo web URLs before building commit/branch links. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  return String(value ?? '').trim().replace(/\.git$/i, '').replace(/\/+$/, '');
};

export const TaskGitStatusPanel: FC<TaskGitStatusPanelProps> = ({ task, variant = 'full' }) => {
  // Render git status details for task detail + group pages. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const t = useT();

  const view = useMemo(() => {
    const result: any = task?.result;
    const gitStatus = result?.gitStatus;
    if (!gitStatus || !gitStatus.enabled) return null;

    const finalSnapshot = gitStatus.final ?? null;
    const baselineSnapshot = gitStatus.baseline ?? null;
    const workingTree = gitStatus.workingTree ?? null;
    const delta = gitStatus.delta ?? null;
    const push = gitStatus.push ?? null;
    const branch = finalSnapshot?.branch || baselineSnapshot?.branch || '';
    const headSha = finalSnapshot?.headSha || baselineSnapshot?.headSha || '';

    const repoWorkflow = result?.repoWorkflow ?? null;
    const upstreamWebUrl =
      repoWorkflow?.upstream && typeof repoWorkflow.upstream.webUrl === 'string' ? repoWorkflow.upstream.webUrl : '';
    const forkWebUrl = repoWorkflow?.fork && typeof repoWorkflow.fork.webUrl === 'string' ? repoWorkflow.fork.webUrl : '';
    const pushWebUrl = finalSnapshot?.pushWebUrl || (repoWorkflow?.mode === 'fork' ? forkWebUrl : upstreamWebUrl) || '';
    const webBase = normalizeWebBase(pushWebUrl);

    const provider = task?.repo?.provider || task?.repoProvider || 'gitlab';
    const commitHref = webBase && headSha ? `${webBase}${provider === 'gitlab' ? '/-/commit/' : '/commit/'}${headSha}` : '';
    const branchHref =
      webBase && branch && branch !== 'HEAD'
        ? `${webBase}${provider === 'gitlab' ? '/-/tree/' : '/tree/'}${encodeURIComponent(branch)}`
        : '';

    const staged = workingTree?.staged ?? [];
    const unstaged = workingTree?.unstaged ?? [];
    const untracked = workingTree?.untracked ?? [];
    const totalChanges = staged.length + unstaged.length + untracked.length;

    return {
      branch,
      headSha,
      shortSha: headSha ? headSha.slice(0, 8) : '',
      ahead: finalSnapshot?.ahead,
      behind: finalSnapshot?.behind,
      delta,
      push,
      webBase,
      commitHref,
      branchHref,
      staged,
      unstaged,
      untracked,
      totalChanges,
      pushTargetLabel: repoWorkflow?.mode === 'fork' ? t('tasks.gitStatus.pushTarget.fork') : t('tasks.gitStatus.pushTarget.upstream')
    };
  }, [task, t]);

  if (!view) {
    return (
      <Card size="small" className="hc-card">
        <Typography.Text type="secondary">{t('tasks.gitStatus.unavailable')}</Typography.Text>
      </Card>
    );
  }

  const pushStatus = view.push?.status || 'unknown';
  const pushLabelKey =
    pushStatus === 'pushed'
      ? 'tasks.gitStatus.push.pushed'
      : pushStatus === 'unpushed'
        ? 'tasks.gitStatus.push.unpushed'
        : pushStatus === 'error'
          ? 'tasks.gitStatus.push.error'
          : pushStatus === 'not_applicable'
            ? 'tasks.gitStatus.push.notApplicable'
            : 'tasks.gitStatus.push.unknown';

  const pushColor =
    pushStatus === 'pushed' ? 'green' : pushStatus === 'unpushed' ? 'orange' : pushStatus === 'error' ? 'red' : undefined;

  const dirtyColor = view.totalChanges > 0 ? 'volcano' : 'green';
  const commitColor = view.delta?.headChanged ? 'blue' : undefined;
  const branchColor = view.delta?.branchChanged ? 'gold' : undefined;

  return (
    <Card size="small" className="hc-card" title={t('tasks.gitStatus.title')} styles={{ body: { padding: variant === 'compact' ? 12 : 16 } }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space wrap size={8}>
          <Tag color={dirtyColor}>{view.totalChanges > 0 ? t('tasks.gitStatus.dirty') : t('tasks.gitStatus.clean')}</Tag>
          <Tag color={commitColor}>{view.delta?.headChanged ? t('tasks.gitStatus.commit.created') : t('tasks.gitStatus.commit.none')}</Tag>
          <Tag color={pushColor}>{t(pushLabelKey)}</Tag>
          {view.delta?.branchChanged ? <Tag color={branchColor}>{t('tasks.gitStatus.branch.changed')}</Tag> : null}
        </Space>

        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">{t('tasks.gitStatus.branch')}</Typography.Text>
          {view.branchHref ? (
            <Typography.Link href={view.branchHref} target="_blank" rel="noreferrer">
              {view.branch}
            </Typography.Link>
          ) : (
            <Typography.Text>{view.branch || '-'}</Typography.Text>
          )}
        </Space>

        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">{t('tasks.gitStatus.commit')}</Typography.Text>
          {view.commitHref ? (
            <Typography.Link href={view.commitHref} target="_blank" rel="noreferrer">
              {view.shortSha || view.headSha || '-'}
            </Typography.Link>
          ) : (
            <Typography.Text code>{view.shortSha || view.headSha || '-'}</Typography.Text>
          )}
        </Space>

        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">{t('tasks.gitStatus.pushTarget')}</Typography.Text>
          {view.webBase ? (
            <Typography.Link href={view.webBase} target="_blank" rel="noreferrer">
              {view.pushTargetLabel}
            </Typography.Link>
          ) : (
            <Typography.Text>{view.pushTargetLabel}</Typography.Text>
          )}
        </Space>

        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">{t('tasks.gitStatus.divergence')}</Typography.Text>
          <Typography.Text>
            {typeof view.ahead === 'number' || typeof view.behind === 'number'
              ? t('tasks.gitStatus.divergence.value', {
                  ahead: view.ahead ?? 0,
                  behind: view.behind ?? 0
                })
              : '-'}
          </Typography.Text>
        </Space>

        <Divider style={{ margin: '8px 0' }} />

        <Space direction="vertical" size={6}>
          <Typography.Text strong>{t('tasks.gitStatus.files')}</Typography.Text>
          {view.totalChanges === 0 ? (
            <Typography.Text type="secondary">{t('tasks.gitStatus.files.none')}</Typography.Text>
          ) : (
            <Space direction="vertical" size={6}>
              {view.staged.length ? (
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">{t('tasks.gitStatus.files.staged', { count: view.staged.length })}</Typography.Text>
                  {view.staged.map((file) => (
                    <Typography.Text key={`staged-${file}`} code>
                      {file}
                    </Typography.Text>
                  ))}
                </Space>
              ) : null}
              {view.unstaged.length ? (
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">{t('tasks.gitStatus.files.unstaged', { count: view.unstaged.length })}</Typography.Text>
                  {view.unstaged.map((file) => (
                    <Typography.Text key={`unstaged-${file}`} code>
                      {file}
                    </Typography.Text>
                  ))}
                </Space>
              ) : null}
              {view.untracked.length ? (
                <Space direction="vertical" size={2}>
                  <Typography.Text type="secondary">{t('tasks.gitStatus.files.untracked', { count: view.untracked.length })}</Typography.Text>
                  {view.untracked.map((file) => (
                    <Typography.Text key={`untracked-${file}`} code>
                      {file}
                    </Typography.Text>
                  ))}
                </Space>
              ) : null}
            </Space>
          )}
        </Space>
      </Space>
    </Card>
  );
};
