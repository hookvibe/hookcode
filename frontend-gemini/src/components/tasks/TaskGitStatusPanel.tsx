import { FC, useEffect, useMemo, useState } from 'react';
import { Button, Card, Divider, Space, Tag, Typography } from '@/ui';
import type { Task, TaskGitStatus } from '../../api';
import { pushTaskGitChanges } from '../../api';
import { useT } from '../../i18n';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

interface TaskGitStatusPanelProps {
  task?: Task | null;
  variant?: 'compact' | 'full';
}

const normalizeWebBase = (value: string): string => {
  // Normalize repo web URLs before building commit/branch links. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  return String(value ?? '').trim().replace(/\.git$/i, '').replace(/\/+$/, '');
};

const PUSH_ERROR_KEY_BY_CODE: Record<string, string> = {
  // Map backend push error codes to localized UI copy. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  GIT_STATUS_UNAVAILABLE: 'tasks.gitStatus.push.error.unavailable',
  GIT_PUSH_NOT_NEEDED: 'tasks.gitStatus.push.error.notNeeded',
  GIT_PUSH_NOT_FORK: 'tasks.gitStatus.push.error.notFork',
  GIT_PUSH_MISSING_HEAD: 'tasks.gitStatus.push.error.missingHead',
  GIT_PUSH_FORBIDDEN: 'tasks.gitStatus.push.error.notAllowed',
  GIT_PUSH_WORKSPACE_MISSING: 'tasks.gitStatus.push.error.workspaceMissing',
  GIT_PUSH_HEAD_UNAVAILABLE: 'tasks.gitStatus.push.error.headUnavailable',
  GIT_PUSH_HEAD_MISMATCH: 'tasks.gitStatus.push.error.headMismatch',
  GIT_PUSH_REMOTE_MISMATCH: 'tasks.gitStatus.push.error.remoteMismatch',
  GIT_PUSH_DETACHED_HEAD: 'tasks.gitStatus.push.error.detachedHead',
  GIT_PUSH_FAILED: 'tasks.gitStatus.push.failed'
};

export const TaskGitStatusPanel: FC<TaskGitStatusPanelProps> = ({ task, variant = 'full' }) => {
  // Render git status details for task detail + group pages. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const t = useT();
  // Track push action state so the panel can trigger fork pushes safely. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<TaskGitStatus | null>(null);

  useEffect(() => {
    setPushLoading(false);
    setPushError('');
    setOverrideStatus(null);
  }, [task?.id]);

  const view = useMemo(() => {
    const result: any = task?.result;
    const gitStatus = overrideStatus ?? result?.gitStatus;
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
      isFork: repoWorkflow?.mode === 'fork',
      pushTargetLabel: repoWorkflow?.mode === 'fork' ? t('tasks.gitStatus.pushTarget.fork') : t('tasks.gitStatus.pushTarget.upstream')
    };
  }, [overrideStatus, task, t]);

  if (!view) {
    return (
      <Card size="small" className="hc-card">
        <Typography.Text type="secondary">{t('tasks.gitStatus.unavailable')}</Typography.Text>
      </Card>
    );
  }

  const pushStatus = view.push?.status || 'unknown';
  const pushLabelKey =
    pushStatus === 'unpushed'
      ? 'tasks.gitStatus.push.unpushed'
      : pushStatus === 'error'
        ? 'tasks.gitStatus.push.error'
        : pushStatus === 'not_applicable'
          ? 'tasks.gitStatus.push.notApplicable'
          : 'tasks.gitStatus.push.unknown';
  // Use push target wording when a fork push succeeds so the UI is unambiguous. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const pushLabel =
    pushStatus === 'pushed'
      ? t('tasks.gitStatus.push.pushedTarget', { target: view.pushTargetLabel })
      : t(pushLabelKey);

  const pushColor =
    pushStatus === 'pushed' ? 'green' : pushStatus === 'unpushed' ? 'orange' : pushStatus === 'error' ? 'red' : undefined;

  const dirtyColor = view.totalChanges > 0 ? 'volcano' : 'green';
  const commitColor = view.delta?.headChanged ? 'blue' : undefined;
  const branchColor = view.delta?.branchChanged ? 'gold' : undefined;
  const canPush =
    Boolean(task?.permissions?.canManage) &&
    view.isFork &&
    pushStatus === 'unpushed' &&
    Boolean(view.branch) &&
    view.branch !== 'HEAD';

  const handlePush = async () => {
    if (!task?.id || pushLoading) return;
    setPushLoading(true);
    setPushError('');
    try {
      // Trigger a fork push and refresh the panel with the returned git status. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const updated = await pushTaskGitChanges(task.id);
      setOverrideStatus(updated.result?.gitStatus ?? null);
    } catch (err) {
      // Translate backend error codes into localized push errors. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
      const code = (err as any)?.response?.data?.code as string | undefined;
      const key = code ? PUSH_ERROR_KEY_BY_CODE[code] : undefined;
      setPushError(key ? t(key) : t('tasks.gitStatus.push.failed'));
    } finally {
      setPushLoading(false);
    }
  };

  // Surface explicit warnings when push state indicates a head/remote mismatch. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const pushWarningKey =
    view.push?.reason === 'head_mismatch'
      ? 'tasks.gitStatus.push.warning.headMismatch'
      : view.push?.reason === 'push_remote_mismatch'
        ? 'tasks.gitStatus.push.warning.remoteMismatch'
        : null;

  return (
    <Card
      size="small"
      className={variant === 'compact' ? 'hc-card hc-chat-git-status' : 'hc-card'}
      title={t('tasks.gitStatus.title')}
      styles={{ body: { padding: variant === 'compact' ? 12 : 16 } }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space wrap size={8}>
          <Tag color={dirtyColor}>{view.totalChanges > 0 ? t('tasks.gitStatus.dirty') : t('tasks.gitStatus.clean')}</Tag>
          <Tag color={commitColor}>{view.delta?.headChanged ? t('tasks.gitStatus.commit.created') : t('tasks.gitStatus.commit.none')}</Tag>
          <Tag color={pushColor}>{pushLabel}</Tag>
          {view.delta?.branchChanged ? <Tag color={branchColor}>{t('tasks.gitStatus.branch.changed')}</Tag> : null}
        </Space>
        {pushWarningKey ? (
          <Typography.Text type="warning">
            {t(pushWarningKey)}
          </Typography.Text>
        ) : null}
        {canPush || pushError ? (
          <Space align="center" size={8}>
            {canPush ? (
              <Button size="small" type="primary" loading={pushLoading} onClick={handlePush}>
                {t('tasks.gitStatus.push.action', { target: view.pushTargetLabel })}
              </Button>
            ) : null}
            {pushError ? <Typography.Text type="danger">{pushError}</Typography.Text> : null}
          </Space>
        ) : null}

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