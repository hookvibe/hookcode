import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, App, Avatar, Button, Card, Col, Descriptions, Empty, Input, Popconfirm, Radio, Row, Select, Space, Steps, Switch, Tag, Typography } from '@/ui';
import {
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  GitlabOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  UserOutlined
} from '@/ui/icons';
import type { Task, TaskRepoSummary, TaskRobotSummary } from '../api';
import { deleteTask, executeTaskNow, fetchTask, retryTask } from '../api';
import { useLocale, useT } from '../i18n';
import { buildRepoHash, buildTaskGroupHash, buildTasksHash } from '../router';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { TaskLogViewer } from '../components/TaskLogViewer';
import { TaskGitStatusPanel } from '../components/tasks/TaskGitStatusPanel';
import { PageNav } from '../components/nav/PageNav';
import { getPrevHashForBack, isInAppHash } from '../navHistory';
import {
  eventTag,
  extractTargetLink,
  extractUser,
  extractTaskResultText,
  formatRef,
  getTaskTitle,
  isTerminalStatus,
  queuedHintText,
  statusTag
} from '../utils/task';
import { buildTaskTemplateContext, renderTemplate } from '../utils/template';
import { LogViewerSkeleton } from '../components/skeletons/LogViewerSkeleton';
import { TaskDetailSkeleton } from '../components/skeletons/TaskDetailSkeleton';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

/**
 * TaskDetailPage:
 * - Business context: inspect a single task execution (metadata, retry/delete controls, logs, and output).
 * - Module: `frontend-chat` migration (Tasks).
 *
 * Key behaviors:
 * - Load task by id.
 * - Allow manage actions (retry / force retry / delete) when `task.permissions.canManage`.
 * - Provide deep links to repo detail (and optional robot focus) and to task group chat.
 *
 * Change record:
 * - 2026-01-12: Migrated legacy task detail capabilities into `frontend-chat`.
 * - 2026-01-12: Remove header refresh button to keep the PageNav actions focused on task-specific operations.
 * - 2026-01-12: Add the top "Repository / Robot / Author" cards to match the legacy frontend task detail layout.
 */

export interface TaskDetailPageProps {
  taskId: string;
  userPanel?: ReactNode;
  taskLogsEnabled?: boolean | null;
}

const providerLabel = (provider: string) => (provider === 'github' ? 'GitHub' : 'GitLab');

export const TaskDetailPage: FC<TaskDetailPageProps> = ({ taskId, userPanel, taskLogsEnabled }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initialFetchKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await fetchTask(taskId);
      setTask(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.task.fetchFailed'));
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [message, t, taskId]);

  useEffect(() => {
    // Avoid double-fetching the same task when effects run twice in tests or strict mode. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
    if (!taskId) return;
    if (initialFetchKeyRef.current === taskId) return;
    initialFetchKeyRef.current = taskId;
    void refresh();
  }, [refresh, taskId]);

  const formatDateTime = useCallback(
    (iso: string) => {
      if (!iso) return '-';
      try {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const formatDuration = useCallback((durationMs?: number) => {
    // Format dependency install durations for task diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return '-';
    if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
    const totalSeconds = Math.round(durationMs / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }, []);

  const canManageTask = Boolean(task?.permissions?.canManage);
  const canOpenRepo = Boolean(task?.repo?.id ?? task?.repoId);
  const canOpenGroup = Boolean(task?.groupId);
  const effectiveTaskLogsEnabled = taskLogsEnabled === undefined ? true : taskLogsEnabled; // Guard Live logs rendering with backend feature flags to avoid 404 reconnect loops. 0nazpc53wnvljv5yh7c6

  const repoSummary = useMemo<TaskRepoSummary | null>(() => {
    if (!task) return null;
    if (task.repo) return task.repo;
    if (task.repoId && task.repoProvider) {
      return { id: task.repoId, provider: task.repoProvider, name: task.repoId, enabled: true };
    }
    return null;
  }, [task]);

  const robotSummary = useMemo<TaskRobotSummary | null>(() => {
    if (!task) return null;
    if (task.robot) return task.robot;
    if (task.robotId) {
      return { id: task.robotId, repoId: task.repoId ?? '', name: task.robotId, permission: 'read', enabled: true };
    }
    return null;
  }, [task]);

  const repoDetailHref = useMemo(() => {
    const repoIdResolved = task?.repo?.id ?? task?.repoId;
    if (!repoIdResolved) return '';
    const qs = new URLSearchParams();
    qs.set('from', 'task');
    qs.set('taskId', taskId);
    return `#/repos/${encodeURIComponent(repoIdResolved)}?${qs.toString()}`;
  }, [task?.repo?.id, task?.repoId, taskId]);

  const robotDetailHref = useMemo(() => {
    const repoIdResolved = task?.repo?.id ?? task?.repoId;
    const robotIdResolved = task?.robot?.id ?? task?.robotId;
    if (!repoIdResolved || !robotIdResolved) return '';
    const qs = new URLSearchParams();
    qs.set('from', 'task');
    qs.set('taskId', taskId);
    qs.set('robotId', robotIdResolved);
    return `#/repos/${encodeURIComponent(repoIdResolved)}?${qs.toString()}`;
  }, [task?.repo?.id, task?.repoId, task?.robot?.id, task?.robotId, taskId]);

  const providerCommentUrl = useMemo(() => {
    const raw = task?.result?.providerCommentUrl;
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    return trimmed ? trimmed : '';
  }, [task?.result?.providerCommentUrl]);

  const tokenUsage = useMemo(() => {
    const raw = task?.result?.tokenUsage as any;
    if (!raw) return null;
    const inputTokens = typeof raw.inputTokens === 'number' && Number.isFinite(raw.inputTokens) ? raw.inputTokens : 0;
    const outputTokens = typeof raw.outputTokens === 'number' && Number.isFinite(raw.outputTokens) ? raw.outputTokens : 0;
    const totalTokens = typeof raw.totalTokens === 'number' && Number.isFinite(raw.totalTokens) ? raw.totalTokens : inputTokens + outputTokens;
    if (inputTokens <= 0 && outputTokens <= 0 && totalTokens <= 0) return null;
    return { inputTokens, outputTokens, totalTokens };
  }, [task?.result?.tokenUsage]);

  const repoWorkflow = useMemo(() => {
    // Display direct-vs-fork repo workflow metadata from the agent for debugging and clarity. 24yz61mdik7tqdgaa152
    const raw = (task?.result as any)?.repoWorkflow;
    if (!raw || typeof raw !== 'object') return null;
    const mode = typeof (raw as any).mode === 'string' ? String((raw as any).mode).trim() : '';
    if (mode !== 'direct' && mode !== 'fork') return null;

    const upstream = (raw as any).upstream && typeof (raw as any).upstream === 'object' ? (raw as any).upstream : null;
    const fork = (raw as any).fork && typeof (raw as any).fork === 'object' ? (raw as any).fork : null;
    const upstreamWebUrl = upstream && typeof upstream.webUrl === 'string' ? upstream.webUrl.trim() : '';
    const forkWebUrl = fork && typeof fork.webUrl === 'string' ? fork.webUrl.trim() : '';

    return {
      mode,
      upstreamSlug: upstream && typeof upstream.slug === 'string' ? upstream.slug.trim() : '',
      forkSlug: fork && typeof fork.slug === 'string' ? fork.slug.trim() : '',
      upstreamWebUrl: upstreamWebUrl || '',
      forkWebUrl: forkWebUrl || ''
    };
  }, [task?.result]);

  // Capture dependency install results for the task detail sidebar. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const dependencyResult = task?.dependencyResult ?? null;
  const dependencySteps = useMemo(
    () => (Array.isArray(dependencyResult?.steps) ? dependencyResult?.steps ?? [] : []),
    [dependencyResult]
  );

  // Track dependency UI filters/expansion state to support richer diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  type DependencyFilter = 'all' | 'success' | 'failed' | 'skipped';
  type DependencySortKey = 'default' | 'status' | 'duration' | 'language' | 'workdir';
  const [dependencyFilter, setDependencyFilter] = useState<DependencyFilter>('all');
  const [dependencyKeyword, setDependencyKeyword] = useState('');
  const [dependencySortKey, setDependencySortKey] = useState<DependencySortKey>('default');
  const [dependencySortDirection, setDependencySortDirection] = useState<'asc' | 'desc'>('asc');
  const [dependencyGroupByWorkdir, setDependencyGroupByWorkdir] = useState(false);
  const [dependencyExpandedKeys, setDependencyExpandedKeys] = useState<Set<string>>(new Set());

  // Normalize dependency steps with stable keys for filter + collapse controls. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const dependencyStepEntries = useMemo(
    () =>
      dependencySteps.map((step, index) => ({
        step,
        index,
        key: `${step.language}-${index}`
      })),
    [dependencySteps]
  );

  const filteredDependencyEntries = useMemo(() => {
    // Filter dependency steps so operators can focus on failures or skips. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const keyword = dependencyKeyword.trim().toLowerCase();
    return dependencyStepEntries.filter((entry) => {
      const step = entry.step;
      if (dependencyFilter !== 'all' && step.status !== dependencyFilter) return false;
      if (!keyword) return true;
      const haystack = [
        step.language,
        step.command,
        step.error,
        step.reason,
        step.workdir,
        step.status
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return haystack.some((value) => value.includes(keyword));
    });
  }, [dependencyFilter, dependencyKeyword, dependencyStepEntries]);

  const sortedDependencyEntries = useMemo(() => {
    // Sort dependency steps for consistent ordering and debugging focus. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (dependencySortKey === 'default') return filteredDependencyEntries;
    const direction = dependencySortDirection === 'desc' ? -1 : 1;
    const statusWeight = (status: string) => {
      if (status === 'failed') return 3;
      if (status === 'skipped') return 2;
      return 1;
    };
    const compareString = (a: string, b: string) => a.localeCompare(b);
    const compareNumber = (a?: number, b?: number) => {
      const aNum = typeof a === 'number' ? a : Number.POSITIVE_INFINITY;
      const bNum = typeof b === 'number' ? b : Number.POSITIVE_INFINITY;
      return aNum - bNum;
    };
    return [...filteredDependencyEntries].sort((left, right) => {
      const leftStep = left.step;
      const rightStep = right.step;
      let diff = 0;
      switch (dependencySortKey) {
        case 'status':
          diff = statusWeight(leftStep.status) - statusWeight(rightStep.status);
          break;
        case 'duration':
          diff = compareNumber(leftStep.duration, rightStep.duration);
          break;
        case 'language':
          diff = compareString(leftStep.language, rightStep.language);
          break;
        case 'workdir':
          diff = compareString(leftStep.workdir ?? '', rightStep.workdir ?? '');
          break;
        default:
          diff = 0;
      }
      if (diff === 0) {
        diff = left.index - right.index;
      }
      return diff * direction;
    });
  }, [dependencySortDirection, dependencySortKey, filteredDependencyEntries]);

  const groupedDependencyEntries = useMemo(() => {
    // Group dependency steps by workdir when requested for multi-project repos. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (!dependencyGroupByWorkdir) {
      return [{ groupKey: 'all', label: '', entries: sortedDependencyEntries }];
    }
    const groups: Array<{ groupKey: string; entries: typeof sortedDependencyEntries }> = [];
    const seen = new Map<string, { groupKey: string; entries: typeof sortedDependencyEntries }>();
    sortedDependencyEntries.forEach((entry) => {
      const raw = entry.step.workdir?.trim() || '.';
      const existing = seen.get(raw);
      if (existing) {
        existing.entries.push(entry);
        return;
      }
      const nextGroup = { groupKey: raw, entries: [entry] };
      seen.set(raw, nextGroup);
      groups.push(nextGroup);
    });
    return groups;
  }, [dependencyGroupByWorkdir, sortedDependencyEntries]);

  const dependencyCounts = useMemo(() => {
    // Summarize dependency step counts for quick status scanning. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    return dependencySteps.reduce(
      (acc, step) => {
        if (step.status === 'success') acc.success += 1;
        if (step.status === 'failed') acc.failed += 1;
        if (step.status === 'skipped') acc.skipped += 1;
        return acc;
      },
      { success: 0, failed: 0, skipped: 0 }
    );
  }, [dependencySteps]);

  useEffect(() => {
    // Auto-expand failed dependency steps to surface errors by default. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (!dependencyResult) {
      setDependencyExpandedKeys(new Set());
      return;
    }
    const next = new Set<string>();
    dependencyStepEntries.forEach((entry) => {
      if (entry.step.status === 'failed') next.add(entry.key);
    });
    setDependencyExpandedKeys(next);
    setDependencyFilter('all');
  }, [dependencyResult, dependencyStepEntries]);
  const renderDependencyStatusTag = useCallback(
    (status: 'success' | 'partial' | 'skipped' | 'failed') => {
      // Render dependency status tags consistently across summary + steps. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      const color = status === 'success' ? 'green' : status === 'partial' ? 'gold' : status === 'failed' ? 'red' : 'default';
      const label =
        status === 'success'
          ? t('tasks.dependency.status.success')
          : status === 'partial'
            ? t('tasks.dependency.status.partial')
            : status === 'failed'
              ? t('tasks.dependency.status.failed')
              : t('tasks.dependency.status.skipped');
      return <Tag color={color}>{label}</Tag>;
    },
    [t]
  );

  const toggleDependencyStep = useCallback((key: string) => {
    // Toggle dependency step details for focused debugging. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    setDependencyExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAllDependencySteps = useCallback(() => {
    // Expand visible dependency steps to reveal full command/error details. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    setDependencyExpandedKeys((prev) => {
      const next = new Set(prev);
      sortedDependencyEntries.forEach((entry) => next.add(entry.key));
      return next;
    });
  }, [sortedDependencyEntries]);

  const collapseAllDependencySteps = useCallback(() => {
    // Collapse visible dependency steps to keep the panel compact. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    setDependencyExpandedKeys((prev) => {
      const next = new Set(prev);
      sortedDependencyEntries.forEach((entry) => next.delete(entry.key));
      return next;
    });
  }, [sortedDependencyEntries]);

  const resultText = useMemo(() => extractTaskResultText(task), [task]);
  const showResult = Boolean(task && isTerminalStatus(task.status));
  const queueHint = useMemo(() => queuedHintText(t, task), [t, task]); // Show a queued-state explanation instead of a silent detail page. f3a9c2d8e1b7f4a0c6d1

  const payloadPretty = useMemo(() => {
    // Format raw payload for display without assuming the payload is always JSON-serializable. tdlayout20260117k8p3
    if (!task?.payload) return '';
    try {
      return JSON.stringify(task.payload ?? {}, null, 2);
    } catch {
      try {
        return String(task.payload);
      } catch {
        return '';
      }
    }
  }, [task?.payload]);

  const promptPatch = useMemo(() => {
    // Normalize prompt patch (repo config) so the workflow UI can always render a stable section. tdlayout20260117k8p3
    const raw = task?.promptCustom;
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }, [task?.promptCustom]);

  const promptPatchRendered = useMemo(() => {
    // Render prompt patch variables against the task payload so users can debug templates. x0kprszlsorw9vi8jih9
    if (!task || !promptPatch) return '';
    return renderTemplate(promptPatch, buildTaskTemplateContext(task));
  }, [promptPatch, task]);

  type WorkflowPanelKey = 'result' | 'logs' | 'prompt' | 'payload';

  const [activePanel, setActivePanel] = useState<WorkflowPanelKey>('logs');
  const defaultPanelKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Default panel: show Result for terminal tasks, otherwise focus on Live logs. docs/en/developer/plans/taskdetailui20260121/task_plan.md taskdetailui20260121
    if (!task?.id) return;
    if (defaultPanelKeyRef.current === task.id) return;
    defaultPanelKeyRef.current = task.id;
    setActivePanel(isTerminalStatus(task.status) ? 'result' : 'logs');
  }, [task?.id, task?.status]);

  const workflowPanels = useMemo(
    () =>
      [
        {
          key: 'result' as const,
          title: t('task.page.resultTitle'),
          content: (
            <Card size="small" className="hc-card">
              {showResult ? (
                resultText ? (
                  <MarkdownViewer markdown={resultText} className="markdown-result--expanded" />
                ) : (
                  <Typography.Text type="secondary">{t('chat.message.resultEmpty')}</Typography.Text>
                )
              ) : (
                <Typography.Text type="secondary">{t('task.page.resultPending')}</Typography.Text>
              )}
            </Card>
          )
        },
        {
          key: 'logs' as const,
          title: t('task.page.logsTitle'),
          content: (
            <>
              {/* Render the logs viewer only when logs are enabled to prevent endless SSE reconnects. 0nazpc53wnvljv5yh7c6 */}
              {effectiveTaskLogsEnabled === false ? (
                <Alert type="info" showIcon message={t('logViewer.disabled')} />
              ) : effectiveTaskLogsEnabled === null ? (
                <>
                  {/* Show a log-shaped skeleton while the logs feature gate is still loading. ro3ln7zex8d0wyynfj0m */}
                  <LogViewerSkeleton lines={10} ariaLabel={t('common.loading')} />
                </>
              ) : task ? (
                <TaskLogViewer taskId={task.id} canManage={Boolean(task.permissions?.canManage)} tail={800} variant="flat" />
              ) : null}
            </>
          )
        },
        {
          key: 'prompt' as const,
          title: t('tasks.promptCustom'),
          content: (
            <Card size="small" className="hc-card">
              {promptPatch ? (
                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={12} style={{ minWidth: 0 }}>
                    <Typography.Text type="secondary">{t('tasks.promptCustom.raw')}</Typography.Text>
                    <pre className="hc-task-code-block hc-task-code-block--expanded">{promptPatch}</pre>
                  </Col>
                  <Col xs={24} lg={12} style={{ minWidth: 0 }}>
                    <Typography.Text type="secondary">{t('tasks.promptCustom.rendered')}</Typography.Text>
                    <pre className="hc-task-code-block hc-task-code-block--expanded">{promptPatchRendered}</pre>
                  </Col>
                </Row>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              )}
            </Card>
          )
        },
        {
          key: 'payload' as const,
          title: t('tasks.payloadRaw'),
          content: (
            <Card size="small" className="hc-card">
              {payloadPretty ? (
                <pre className="hc-task-code-block hc-task-code-block--expanded">{payloadPretty}</pre>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              )}
            </Card>
          )
        }
      ] as const,
    [effectiveTaskLogsEnabled, payloadPretty, promptPatch, promptPatchRendered, resultText, showResult, t, task]
  );

  const handleRetry = useCallback(
    async (options?: { force?: boolean }) => {
      if (!task) return;
      if (!task.permissions?.canManage) {
        message.warning(t('tasks.empty.noPermission'));
        return;
      }
      setRetrying(true);
      try {
        await retryTask(task.id, options);
        message.success(options?.force ? t('toast.task.forceRetrySuccess') : t('toast.task.retrySuccess'));
        await refresh();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 409) {
          message.warning(t('toast.task.retryBlockedProcessing'));
          return;
        }
        console.error(err);
        message.error(t('toast.task.retryFailedTasksFailed'));
      } finally {
        setRetrying(false);
      }
    },
    [message, refresh, t, task]
  );

  const handleExecuteNow = useCallback(async () => {
    // Allow manual execution when tasks are blocked by time windows. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    if (!task) return;
    if (!task.permissions?.canManage) {
      message.warning(t('tasks.empty.noPermission'));
      return;
    }
    setRetrying(true);
    try {
      await executeTaskNow(task.id);
      message.success(t('toast.task.executeNowSuccess'));
      await refresh();
    } catch (err) {
      console.error(err);
      message.error(t('toast.task.executeNowFailed'));
    } finally {
      setRetrying(false);
    }
  }, [message, refresh, t, task]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!task.permissions?.canManage) {
      message.warning(t('tasks.empty.noPermission'));
      return;
    }
    setDeleting(true);
    try {
      await deleteTask(task.id);
      message.success(t('toast.task.deleted'));
      // Navigation note: fall back to task list after delete.
      window.location.hash = '#/tasks';
    } catch (err) {
      console.error(err);
      message.error(t('toast.task.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [message, t, task]);

  if (!taskId) {
    return (
      <div className="hc-page">
        <div className="hc-empty">
          <Empty description={t('task.page.missingId')} />
        </div>
      </div>
    );
  }

  const headerActions = task ? (
    <Space size={8}>
      {task.status === 'queued' && canManageTask ? (
        task.queue?.reasonCode === 'outside_time_window' ? (
          <Button icon={<PlayCircleOutlined />} onClick={() => void handleExecuteNow()} loading={retrying}>
            {t('tasks.executeNow')}
          </Button>
        ) : (
          <Button icon={<PlayCircleOutlined />} onClick={() => void handleRetry()} loading={retrying}>
            {t('tasks.retry')}
          </Button>
        )
      ) : null}

      {task.status === 'failed' && canManageTask ? (
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => void handleRetry()} loading={retrying}>
          {t('tasks.retry')}
        </Button>
      ) : null}

      {task.status === 'processing' && canManageTask ? (
        <Popconfirm
          title={t('tasks.forceRetry.confirmTitle')}
          okText={t('tasks.forceRetry')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleRetry({ force: true })}
        >
          <Button danger icon={<PlayCircleOutlined />} loading={retrying}>
            {t('tasks.forceRetry')}
          </Button>
        </Popconfirm>
      ) : null}

      {canManageTask ? (
        <Popconfirm
          title={t('tasks.delete.confirmTitle')}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleDelete()}
        >
          {/* Keep delete icon labeled so accessible names match legacy button text expectations. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127 */}
          <Button danger icon={<DeleteOutlined aria-label="delete" />} loading={deleting}>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ) : null}
    </Space>
  ) : undefined;

  const user = task ? extractUser(task.payload) : undefined;
  const target = task ? extractTargetLink(t, task) : undefined;

  const headerBack = useMemo(() => {
    // Header back behavior:
    // - Module: Frontend Chat / Tasks.
    // - Business intent: match legacy frontend "header back icon" rules.
    // - Key steps:
    //   1) Prefer going back to the previous in-app hash (when safe).
    //   2) If there is no safe previous hash (e.g. opened from sidebar or deep-linked), fall back to `#/tasks`.
    // - Change record: 2026-01-12 - Introduce header back for task detail and reuse the shared nav-history helper.
    return {
      ariaLabel: t('common.backToList'),
      onClick: () => {
        if (typeof window === 'undefined') return;
        const currentHash = String(window.location.hash ?? '');
        const prevHash = String(getPrevHashForBack() ?? '');
        if (isInAppHash(prevHash) && prevHash !== currentHash) {
          window.history.back();
          return;
        }
        window.location.hash = buildTasksHash();
      }
    };
  }, [t]);

  return (
    <div className="hc-page hc-task-detail-page">
      {/* Redesign the task detail view to full-width with a summary strip and Steps-connected workflow. tdlayout20260117k8p3 */}
      <PageNav
        back={headerBack}
        title={task ? getTaskTitle(task) : t('task.page.title')}
        meta={
          task ? (
            <Space size={10}>
              {statusTag(t, task.status)}
              <Typography.Text type="secondary">{repoSummary?.name ?? task.repoId ?? '-'}</Typography.Text>
              <Typography.Text type="secondary">{t('task.page.updatedAt', { time: formatDateTime(task.updatedAt) })}</Typography.Text>
            </Space>
          ) : undefined
        }
        actions={headerActions}
        userPanel={userPanel}
      />

      {task ? (
        <div className="hc-task-summary-strip">
          <div className="hc-task-summary-strip__scroller">
            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  {repoSummary?.provider === 'gitlab' ? <GitlabOutlined style={{ fontSize: 16 }} /> : <CodeOutlined style={{ fontSize: 16 }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.repo')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {repoSummary ? (
                      <Space size={8} wrap>
                        <Tag color={repoSummary.provider === 'github' ? 'geekblue' : 'orange'}>{providerLabel(repoSummary.provider)}</Tag>
                        <Typography.Link onClick={() => (window.location.hash = repoDetailHref || buildRepoHash(repoSummary.id))}>
                          {repoSummary.name}
                        </Typography.Link>
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <RobotOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.robot')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {robotSummary ? (
                      <Space size={8} wrap>
                        <Tag color={robotSummary.permission === 'write' ? 'volcano' : 'blue'}>{robotSummary.permission}</Tag>
                        {robotDetailHref ? (
                          <Typography.Link href={robotDetailHref}>{robotSummary.name || robotSummary.id}</Typography.Link>
                        ) : (
                          <Typography.Text>{robotSummary.name || robotSummary.id}</Typography.Text>
                        )}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  {user?.avatar ? (
                    <Avatar src={user.avatar} size={24} style={{ borderRadius: 6 }}>
                      {String(user.name || user.username || '?').slice(0, 1)}
                    </Avatar>
                  ) : (
                    <UserOutlined style={{ fontSize: 16 }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.author')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {user ? (
                      <Space size={6} wrap>
                        <Typography.Text>{String(user.name || user.username || '-').trim()}</Typography.Text>
                        {user.username ? <Typography.Text type="secondary"> @{user.username}</Typography.Text> : null}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <InfoCircleOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.status')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    <Space size={6} wrap>
                      {statusTag(t, task.status)}
                      {eventTag(t, task.eventType)}
                    </Space>
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <LinkOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.target')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {target ? (
                      <Typography.Link href={target.href} target="_blank" rel="noreferrer">
                        {target.text}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <ClockCircleOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.updatedAt')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    <Space orientation="vertical" size={2}>
                      <Typography.Text>{formatDateTime(task.updatedAt)}</Typography.Text>
                      {/* <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t('tasks.field.createdAt')}: {formatDateTime(task.createdAt)}
                      </Typography.Text> */}
                    </Space>
                  </div>
                </div>
              </Space>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hc-page__body">
        {task?.status === 'queued' && queueHint ? (
          /* Display queue diagnosis so the detail page is not silent while waiting. f3a9c2d8e1b7f4a0c6d1 */
          <Alert type="info" showIcon title={t('tasks.queue.hintTitle')} description={queueHint} style={{ marginBottom: 12 }} />
        ) : null}
        {task ? (
          <div className="hc-task-detail-layout">
            <div className="hc-task-detail-sidebar">
              <Card size="small" title={t('tasks.detailTitle')} className="hc-card">
                <Descriptions column={1} size="small" styles={{ label: { width: 132 } }}>
                  <Descriptions.Item label={t('tasks.field.repo')}>
                    {repoSummary ? (
                      <Space size={8} wrap>
                        <Tag color={repoSummary.provider === 'github' ? 'geekblue' : 'orange'}>{providerLabel(repoSummary.provider)}</Tag>
                        <Typography.Link onClick={() => (window.location.hash = repoDetailHref || buildRepoHash(repoSummary.id))}>
                          {repoSummary.name}
                        </Typography.Link>
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.robot')}>
                    {robotSummary ? (
                      <Space size={8} wrap>
                        <Tag color={robotSummary.permission === 'write' ? 'volcano' : 'blue'}>{robotSummary.permission}</Tag>
                        {robotDetailHref ? (
                          <Typography.Link href={robotDetailHref}>{robotSummary.name || robotSummary.id}</Typography.Link>
                        ) : (
                          <Typography.Text>{robotSummary.name || robotSummary.id}</Typography.Text>
                        )}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  {repoWorkflow ? (
                    <Descriptions.Item label={t('tasks.field.repoWorkflow')}>
                      <Space size={8} wrap>
                        <Tag color={repoWorkflow.mode === 'fork' ? 'purple' : 'green'}>
                          {repoWorkflow.mode === 'fork' ? t('tasks.repoWorkflow.fork') : t('tasks.repoWorkflow.direct')}
                        </Tag>

                        {repoWorkflow.upstreamWebUrl ? (
                          <Typography.Link href={repoWorkflow.upstreamWebUrl} target="_blank" rel="noreferrer">
                            {repoWorkflow.upstreamSlug || repoWorkflow.upstreamWebUrl}
                          </Typography.Link>
                        ) : repoWorkflow.upstreamSlug ? (
                          <Typography.Text>{repoWorkflow.upstreamSlug}</Typography.Text>
                        ) : null}

                        {repoWorkflow.mode === 'fork' ? (
                          repoWorkflow.forkWebUrl ? (
                            <Typography.Link href={repoWorkflow.forkWebUrl} target="_blank" rel="noreferrer">
                              {repoWorkflow.forkSlug || repoWorkflow.forkWebUrl}
                            </Typography.Link>
                          ) : repoWorkflow.forkSlug ? (
                            <Typography.Text type="secondary">{repoWorkflow.forkSlug}</Typography.Text>
                          ) : null
                        ) : null}
                      </Space>
                    </Descriptions.Item>
                  ) : null}

                  <Descriptions.Item label={t('tasks.field.author')}>
                    {user ? (
                      <Space size={6} wrap>
                        <Typography.Text>{String(user.name || user.username || '-').trim()}</Typography.Text>
                        {user.username ? <Typography.Text type="secondary"> @{user.username}</Typography.Text> : null}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.event')}>{eventTag(t, task.eventType)}</Descriptions.Item>
                  <Descriptions.Item label={t('tasks.field.status')}>{statusTag(t, task.status)}</Descriptions.Item>
                  <Descriptions.Item label={t('tasks.field.title')}>{task.title || '-'}</Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.group')}>
                    {canOpenGroup ? (
                      <Typography.Link onClick={() => (window.location.hash = buildTaskGroupHash(String(task.groupId)))}>
                        {String(task.groupId)}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.target')}>
                    {target ? (
                      <Typography.Link href={target.href} target="_blank" rel="noreferrer">
                        {target.text}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.ref')}>
                    <Typography.Text>{formatRef(task.ref) || '-'}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.retries')}>
                    <Typography.Text>{String(task.retries ?? 0)}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.createdAt')}>
                    <Typography.Text>{formatDateTime(task.createdAt)}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.updatedAt')}>
                    <Typography.Text>{formatDateTime(task.updatedAt)}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.id')}>
                    <Typography.Text code>{task.id}</Typography.Text>
                  </Descriptions.Item>

                  {providerCommentUrl ? (
                    <Descriptions.Item label={t('tasks.field.providerComment')}>
                      <Typography.Link href={providerCommentUrl} target="_blank" rel="noreferrer">
                        {t('tasks.openProviderComment')}
                      </Typography.Link>
                    </Descriptions.Item>
                  ) : null}

                  {tokenUsage ? (
                    <Descriptions.Item label={t('tasks.field.tokens')}>
                      <Typography.Text>
                        {t('tasks.tokens.format', {
                          input: tokenUsage.inputTokens,
                          output: tokenUsage.outputTokens,
                          total: tokenUsage.totalTokens
                        })}
                      </Typography.Text>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>

                {!canOpenRepo ? (
                  <Alert type="info" showIcon message={t('tasks.repoMissing')} style={{ marginTop: 12 }} />
                ) : null}
              </Card>
              {dependencyResult ? (
                <div style={{ marginTop: 12 }}>
                  {/* Show dependency install outcomes to help debug missing runtimes or install failures. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
                  <Card size="small" title={t('tasks.dependency.title')} className="hc-card">
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Space size={8} wrap>
                        {renderDependencyStatusTag(dependencyResult.status)}
                        <Typography.Text type="secondary">
                          {t('tasks.dependency.totalDuration', { duration: formatDuration(dependencyResult.totalDuration) })}
                        </Typography.Text>
                      </Space>

                      {dependencySteps.length ? (
                        <>
                          <Space size={12} wrap>
                            {/* Filter dependency steps by status to focus troubleshooting. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
                            <Space size={6} wrap align="center">
                              <Typography.Text type="secondary">{t('tasks.dependency.filter.label')}</Typography.Text>
                              <Radio.Group
                                optionType="button"
                                buttonStyle="solid"
                                value={dependencyFilter}
                                onChange={(event) => setDependencyFilter(event.target.value)}
                                aria-label={t('tasks.dependency.filter.label')}
                                data-testid="dependency-filter"
                                options={[
                                  { label: t('tasks.dependency.filter.all'), value: 'all' },
                                  { label: t('tasks.dependency.filter.failed'), value: 'failed' },
                                  { label: t('tasks.dependency.filter.skipped'), value: 'skipped' },
                                  { label: t('tasks.dependency.filter.success'), value: 'success' }
                                ]}
                              />
                            </Space>
                            <Input
                              allowClear
                              value={dependencyKeyword}
                              onChange={(event) => setDependencyKeyword(event.target.value)}
                              placeholder={t('tasks.dependency.filter.keyword')}
                              style={{ minWidth: 220 }}
                              aria-label={t('tasks.dependency.filter.keyword')}
                              data-testid="dependency-keyword"
                            />
                            <Space size={6} wrap>
                              <Button size="small" onClick={expandAllDependencySteps} disabled={!sortedDependencyEntries.length}>
                                {t('tasks.dependency.expandAll')}
                              </Button>
                              <Button size="small" onClick={collapseAllDependencySteps} disabled={!sortedDependencyEntries.length}>
                                {t('tasks.dependency.collapseAll')}
                              </Button>
                            </Space>
                          </Space>

                          {/* Provide sorting + grouping toggles for dependency diagnostics. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
                          <Space size={12} wrap>
                            <Space size={6} wrap align="center">
                              <Typography.Text type="secondary">{t('tasks.dependency.sort.label')}</Typography.Text>
                              <Select
                                size="small"
                                value={dependencySortKey}
                                onChange={(value) => setDependencySortKey(value)}
                                aria-label={t('tasks.dependency.sort.label')}
                                style={{ minWidth: 160 }}
                                options={[
                                  { value: 'default', label: t('tasks.dependency.sort.default') },
                                  { value: 'status', label: t('tasks.dependency.sort.status') },
                                  { value: 'duration', label: t('tasks.dependency.sort.duration') },
                                  { value: 'language', label: t('tasks.dependency.sort.language') },
                                  { value: 'workdir', label: t('tasks.dependency.sort.workdir') }
                                ]}
                              />
                            </Space>
                            <Space size={6} wrap align="center">
                              <Typography.Text type="secondary">{t('tasks.dependency.sort.direction')}</Typography.Text>
                              <Select
                                size="small"
                                value={dependencySortDirection}
                                onChange={(value) => setDependencySortDirection(value)}
                                aria-label={t('tasks.dependency.sort.direction')}
                                style={{ minWidth: 140 }}
                                options={[
                                  { value: 'asc', label: t('tasks.dependency.sort.asc') },
                                  { value: 'desc', label: t('tasks.dependency.sort.desc') }
                                ]}
                              />
                            </Space>
                            <Space size={6} wrap align="center">
                              <Typography.Text type="secondary">{t('tasks.dependency.group.label')}</Typography.Text>
                              <Switch
                                checked={dependencyGroupByWorkdir}
                                onChange={(checked) => setDependencyGroupByWorkdir(checked)}
                                aria-label={t('tasks.dependency.group.label')}
                              />
                            </Space>
                          </Space>

                          <Space size={6} wrap>
                            <Tag color="green">
                              {t('tasks.dependency.status.success')} {dependencyCounts.success}
                            </Tag>
                            <Tag color="red">
                              {t('tasks.dependency.status.failed')} {dependencyCounts.failed}
                            </Tag>
                            <Tag color="default">
                              {t('tasks.dependency.status.skipped')} {dependencyCounts.skipped}
                            </Tag>
                          </Space>

                          {sortedDependencyEntries.length ? (
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              {groupedDependencyEntries.map((group) => {
                                const groupLabel =
                                  group.groupKey === '.'
                                    ? t('tasks.dependency.group.root')
                                    : group.groupKey;
                                const groupCounts = group.entries.reduce(
                                  (acc, entry) => {
                                    if (entry.step.status === 'success') acc.success += 1;
                                    if (entry.step.status === 'failed') acc.failed += 1;
                                    if (entry.step.status === 'skipped') acc.skipped += 1;
                                    return acc;
                                  },
                                  { success: 0, failed: 0, skipped: 0 }
                                );
                                return (
                                  <Space key={group.groupKey} direction="vertical" size={8} style={{ width: '100%' }}>
                                    {dependencyGroupByWorkdir ? (
                                      <Space size={8} wrap>
                                        <Tag>{t('tasks.dependency.group.workdir', { workdir: groupLabel })}</Tag>
                                        <Typography.Text type="secondary">
                                          {t('tasks.dependency.group.count', { count: group.entries.length })}
                                        </Typography.Text>
                                        <Tag color="green">
                                          {t('tasks.dependency.status.success')} {groupCounts.success}
                                        </Tag>
                                        <Tag color="red">
                                          {t('tasks.dependency.status.failed')} {groupCounts.failed}
                                        </Tag>
                                        <Tag color="default">
                                          {t('tasks.dependency.status.skipped')} {groupCounts.skipped}
                                        </Tag>
                                      </Space>
                                    ) : null}

                                    {group.entries.map((entry) => {
                                      const step = entry.step;
                                      const isExpanded = dependencyExpandedKeys.has(entry.key);
                                      return (
                                        <Card
                                          key={entry.key}
                                          size="small"
                                          className="hc-inner-card"
                                          styles={{ body: { padding: 12 } }}
                                          data-testid={`dependency-step-${entry.index}`}
                                          title={
                                            <Space size={8} wrap>
                                              <Tag>{step.language}</Tag>
                                              {renderDependencyStatusTag(step.status)}
                                              {step.workdir && !dependencyGroupByWorkdir ? (
                                                <Typography.Text type="secondary">
                                                  {t('tasks.dependency.workdir', { workdir: step.workdir })}
                                                </Typography.Text>
                                              ) : null}
                                              {typeof step.duration === 'number' ? (
                                                <Typography.Text type="secondary">
                                                  {t('tasks.dependency.stepDuration', { duration: formatDuration(step.duration) })}
                                                </Typography.Text>
                                              ) : null}
                                            </Space>
                                          }
                                          extra={
                                            <Button
                                              type="link"
                                              size="small"
                                              onClick={() => toggleDependencyStep(entry.key)}
                                              aria-expanded={isExpanded}
                                            >
                                              {isExpanded ? t('tasks.dependency.collapse') : t('tasks.dependency.expand')}
                                            </Button>
                                          }
                                        >
                                          {isExpanded ? (
                                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                              {step.command ? (
                                                <Typography.Text>{t('tasks.dependency.command', { command: step.command })}</Typography.Text>
                                              ) : null}
                                              {step.reason ? (
                                                <Typography.Text type="secondary">{t('tasks.dependency.reason', { reason: step.reason })}</Typography.Text>
                                              ) : null}
                                              {step.error ? (
                                                <Typography.Text type="danger">{t('tasks.dependency.error', { error: step.error })}</Typography.Text>
                                              ) : null}
                                            </Space>
                                          ) : null}
                                        </Card>
                                      );
                                    })}
                                  </Space>
                                );
                              })}
                            </Space>
                          ) : (
                            <Typography.Text type="secondary">{t('tasks.dependency.filter.empty')}</Typography.Text>
                          )}
                        </>
                      ) : (
                        <Typography.Text type="secondary">{t('tasks.dependency.empty')}</Typography.Text>
                      )}
                    </Space>
                  </Card>
                </div>
              ) : null}
              {task.result?.gitStatus?.enabled ? (
                <div style={{ marginTop: 12 }}>
                  {/* Render git status in task detail so write-enabled changes are visible. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj */}
                  <TaskGitStatusPanel task={task} variant="full" />
                </div>
              ) : null}
            </div>

            <div className="hc-task-detail-workflow">
              {/* Render a sticky step-bar switcher so only one panel is visible at a time. docs/en/developer/plans/taskdetailui20260121/task_plan.md taskdetailui20260121 */}
              <Card size="small" className="hc-card hc-task-detail-panel-switcher">
                <Steps
                  size="small"
                  current={Math.max(
                    0,
                    workflowPanels.findIndex((panel) => panel.key === activePanel)
                  )}
                  responsive={false}
                  onChange={(next) => {
                    const panel = workflowPanels[next];
                    if (!panel) return;
                    setActivePanel(panel.key);
                  }}
                  items={workflowPanels.map((panel) => ({ title: panel.title }))}
                />
              </Card>
              <div className="hc-task-detail-panel-content">
                {workflowPanels.find((panel) => panel.key === activePanel)?.content ?? null}
              </div>
            </div>
          </div>
        ) : loading ? (
          // Render a task-detail skeleton instead of a generic Empty+icon while loading. ro3ln7zex8d0wyynfj0m
          <TaskDetailSkeleton testId="hc-task-detail-skeleton" ariaLabel={t('common.loading')} />
        ) : (
          <div className="hc-empty">
            <Empty description={t('task.page.notFound')} />
          </div>
        )}
      </div>
    </div>
  );
};
