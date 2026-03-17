import {
  CloudUploadOutlined,
  DeleteOutlined,
  DiffOutlined,
  DownOutlined,
  FileTextOutlined,
  LoadingOutlined,
  RightOutlined,
  RollbackOutlined,
  SaveOutlined,
  ScissorOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { Alert, App, Button, Empty, Input, Popconfirm, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Task, TaskWorkspaceFile, TaskWorkspaceOperation, TaskWorkspaceState } from '../../api';
import { fetchTaskWorkspace, pushTaskGitChanges, runTaskWorkspaceOperation } from '../../api';
import { useT } from '../../i18n';
import { TextPreviewBlock } from '../TextPreviewBlock';
import { calculateUnifiedDiffStats } from '../diff/calculateDiff';
import { DiffView } from '../diff/DiffView';
import { RAW_TEXT_PREVIEW_LIMITS } from '../../utils/textPreview';
import '../../styles/task-git-workspace.css';

const formatCompactPath = (rawPath: string, maxSegments: number = 4): string => {
  const normalizedPath = String(rawPath ?? '').trim();
  if (!normalizedPath) return normalizedPath;
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  if (segments.length <= maxSegments) return normalizedPath;
  return `.../${segments.slice(-maxSegments).join('/')}`;
};

const getBaseName = (rawPath: string): string => {
  const normalized = String(rawPath ?? '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
};

const getKindShortLabel = (kind?: TaskWorkspaceFile['kind']): string => {
  if (kind === 'create') return 'A';
  if (kind === 'delete') return 'D';
  return 'M';
};

const getKindLabelKey = (kind?: TaskWorkspaceFile['kind']): string => {
  if (kind === 'create') return 'tasks.gitWorkspace.kind.create';
  if (kind === 'delete') return 'tasks.gitWorkspace.kind.delete';
  return 'tasks.gitWorkspace.kind.update';
};

const buildInlineDiffPreview = (unifiedDiff: string, maxLines: number = 8): { text: string; truncated: boolean } => {
  const lines = String(unifiedDiff ?? '')
    .split('\n')
    .filter((line) => line.length > 0);
  const relevantLines = lines.filter(
    (line) => line.startsWith('@@') || line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')
  );
  const previewSource = relevantLines.length ? relevantLines : lines;
  const previewLines = previewSource.slice(0, maxLines);
  return {
    text: previewLines.join('\n'),
    truncated: previewSource.length > previewLines.length
  };
};

const truncateSingleLine = (value: string, maxChars: number = 96): string => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
};

const buildSuggestedCommitMessage = (t: ReturnType<typeof useT>, files: TaskWorkspaceFile[]): string => {
  if (!files.length) return '';
  if (files.length === 1) {
    const file = files[0];
    const name = getBaseName(file.path);
    if (file.kind === 'create') return t('tasks.gitWorkspace.commit.suggest.addOne', { name });
    if (file.kind === 'delete') return t('tasks.gitWorkspace.commit.suggest.deleteOne', { name });
    return t('tasks.gitWorkspace.commit.suggest.updateOne', { name });
  }

  const createCount = files.filter((file) => file.kind === 'create').length;
  const deleteCount = files.filter((file) => file.kind === 'delete').length;
  const updateCount = files.filter((file) => file.kind !== 'create' && file.kind !== 'delete').length;
  if (createCount === files.length) return t('tasks.gitWorkspace.commit.suggest.addMany', { count: createCount });
  if (deleteCount === files.length) return t('tasks.gitWorkspace.commit.suggest.deleteMany', { count: deleteCount });
  if (updateCount === files.length) return t('tasks.gitWorkspace.commit.suggest.updateMany', { count: updateCount });
  return t('tasks.gitWorkspace.commit.suggest.mixed', { count: files.length });
};

const getWorkspaceErrorKey = (code?: string): string | null => {
  switch (code) {
    case 'WORKSPACE_READONLY':
      return 'tasks.gitWorkspace.errors.readOnly';
    case 'WORKSPACE_UNAVAILABLE':
    case 'WORKSPACE_REMOTE_FAILED':
      return 'tasks.gitWorkspace.errors.unavailable';
    case 'WORKSPACE_MISSING':
      return 'tasks.gitWorkspace.errors.missing';
    case 'WORKSPACE_NOT_GIT':
      return 'tasks.gitWorkspace.errors.notGit';
    case 'NO_STAGED_CHANGES':
      return 'tasks.gitWorkspace.errors.noStagedChanges';
    case 'COMMIT_MESSAGE_REQUIRED':
      return 'tasks.gitWorkspace.errors.commitMessageRequired';
    case 'INVALID_PATH':
      return 'tasks.gitWorkspace.errors.invalidPath';
    default:
      return null;
  }
};

type FileGroupKey = 'staged' | 'unstaged' | 'untracked';
type ViewerMode = 'diff' | 'file';
type ConfirmKind = 'discard' | 'delete_untracked';

interface TaskGitWorkspacePanelProps {
  task: Task;
  onTaskUpdated?: () => Promise<void> | void;
}

export const TaskGitWorkspacePanel: FC<TaskGitWorkspacePanelProps> = ({ task, onTaskUpdated }) => {
  const t = useT();
  const { message } = App.useApp();
  const [workspace, setWorkspace] = useState<TaskWorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePath, setActivePath] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('diff');
  const [wrapLines, setWrapLines] = useState(true);
  const [actionLoading, setActionLoading] = useState<TaskWorkspaceOperation | 'push' | 'refresh' | ''>('');
  const [commitMessage, setCommitMessage] = useState('');
  const [composerCollapsed, setComposerCollapsed] = useState(false);
  const [previewPath, setPreviewPath] = useState('');
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [diffChunkCount, setDiffChunkCount] = useState(0);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const deferredSearchValue = useDeferredValue(searchValue);
  const diffViewportRef = useRef<HTMLDivElement | null>(null);
  const commitDraftStorageKey = useMemo(() => `hookcode:task-workspace-commit:${task.id}`, [task.id]);
  const composerCollapsedStorageKey = useMemo(() => `hookcode:task-workspace-composer:${task.id}`, [task.id]);

  const loadWorkspace = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!task.id) return;
      if (!options?.silent) setLoading(true);
      setError('');
      try {
        const nextWorkspace = await fetchTaskWorkspace(task.id);
        setWorkspace(nextWorkspace);
      } catch (err: any) {
        console.error(err);
        const code = err?.response?.data?.code as string | undefined;
        const key = getWorkspaceErrorKey(code);
        setError(key ? t(key) : t('tasks.gitWorkspace.errors.unavailable'));
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [t, task.id]
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (task.status !== 'processing') return undefined;
    const timer = window.setInterval(() => {
      void loadWorkspace({ silent: true });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace, task.status]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setCommitMessage(window.localStorage.getItem(commitDraftStorageKey) ?? '');
    } catch {
      setCommitMessage('');
    }
  }, [commitDraftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (commitMessage.trim()) {
        window.localStorage.setItem(commitDraftStorageKey, commitMessage);
      } else {
        window.localStorage.removeItem(commitDraftStorageKey);
      }
    } catch {
      // Ignore localStorage failures so the workspace panel stays usable in restricted browsers.
    }
  }, [commitDraftStorageKey, commitMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setComposerCollapsed(window.localStorage.getItem(composerCollapsedStorageKey) === '1');
    } catch {
      setComposerCollapsed(false);
    }
  }, [composerCollapsedStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(composerCollapsedStorageKey, composerCollapsed ? '1' : '0');
    } catch {
      // Ignore localStorage failures so the workspace panel stays usable in restricted browsers.
    }
  }, [composerCollapsed, composerCollapsedStorageKey]);

  const files = useMemo(() => workspace?.files ?? [], [workspace?.files]);
  const normalizedQuery = deferredSearchValue.trim().toLowerCase();
  const filteredFiles = useMemo(() => {
    if (!normalizedQuery) return files;
    return files.filter((file) => `${file.path} ${file.kind ?? ''} ${file.sections.join(' ')}`.toLowerCase().includes(normalizedQuery));
  }, [files, normalizedQuery]);
  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  useEffect(() => {
    if (!filteredFiles.length) {
      setActivePath('');
      return;
    }
    if (activePath && filteredFiles.some((file) => file.path === activePath)) return;
    setActivePath(filteredFiles[0].path);
  }, [activePath, filteredFiles]);

  useEffect(() => {
    if (!selectedPaths.length) return;
    const availablePaths = new Set(files.map((file) => file.path));
    setSelectedPaths((current) => current.filter((path) => availablePaths.has(path)));
  }, [files, selectedPaths.length]);

  useEffect(() => {
    if (!previewPath) return;
    if (files.some((file) => file.path === previewPath)) return;
    setPreviewPath('');
  }, [files, previewPath]);

  const activeFile = useMemo(
    () => filteredFiles.find((file) => file.path === activePath) ?? filteredFiles[0] ?? null,
    [activePath, filteredFiles]
  );
  const activeFileStats = useMemo(
    () => calculateUnifiedDiffStats(activeFile?.unifiedDiff ?? ''),
    [activeFile?.unifiedDiff]
  );
  const stagedFiles = useMemo(() => files.filter((file) => file.sections.includes('staged')), [files]);
  const selectionFiles = useMemo(() => files.filter((file) => selectedPathSet.has(file.path)), [files, selectedPathSet]);
  const groupedFiles = useMemo(
    () =>
      (['staged', 'unstaged', 'untracked'] as FileGroupKey[]).map((key) => ({
        key,
        files: filteredFiles.filter((file) => file.sections.includes(key))
      })),
    [filteredFiles]
  );

  const isProcessing = task.status === 'processing';
  const canManage = Boolean(task.permissions?.canManage);
  const isReadOnly = workspace?.readOnly || isProcessing || !canManage;
  const hasSelection = selectedPaths.length > 0;
  const canPush =
    canManage &&
    !isProcessing &&
    !workspace?.readOnly &&
    (task.result as any)?.repoWorkflow?.mode === 'fork' &&
    (task.result as any)?.gitStatus?.push?.status === 'unpushed' &&
    Boolean(workspace?.branch) &&
    workspace?.branch !== 'HEAD';

  const runWorkspaceAction = useCallback(
    async (action: TaskWorkspaceOperation, input?: { paths?: string[]; message?: string }, options?: { clearCommit?: boolean }) => {
      if (!task.id) return;
      setActionLoading(action);
      try {
        const result = await runTaskWorkspaceOperation(task.id, action, input);
        setWorkspace(result.workspace);
        if (options?.clearCommit) {
          setCommitMessage('');
          try {
            window.localStorage.removeItem(commitDraftStorageKey);
          } catch {
            // Ignore storage cleanup failures.
          }
        }
        if (onTaskUpdated) await onTaskUpdated();
        message.success(
          action === 'commit'
            ? t('tasks.gitWorkspace.toast.commitSuccess')
            : action === 'stage'
              ? t('tasks.gitWorkspace.toast.stageSuccess')
              : action === 'unstage'
                ? t('tasks.gitWorkspace.toast.unstageSuccess')
                : action === 'discard'
                  ? t('tasks.gitWorkspace.toast.discardSuccess')
                  : t('tasks.gitWorkspace.toast.deleteSuccess')
        );
      } catch (err: any) {
        console.error(err);
        const code = err?.response?.data?.code as string | undefined;
        const key = getWorkspaceErrorKey(code);
        message.error(key ? t(key) : t('tasks.gitWorkspace.errors.actionFailed'));
      } finally {
        setActionLoading('');
      }
    },
    [commitDraftStorageKey, message, onTaskUpdated, t, task.id]
  );

  const handlePush = useCallback(async () => {
    if (!task.id) return;
    setActionLoading('push');
    try {
      await pushTaskGitChanges(task.id);
      await loadWorkspace({ silent: true });
      if (onTaskUpdated) await onTaskUpdated();
      message.success(t('tasks.gitWorkspace.toast.pushSuccess'));
    } catch (err: any) {
      console.error(err);
      message.error(t('tasks.gitWorkspace.errors.pushFailed'));
    } finally {
      setActionLoading('');
    }
  }, [loadWorkspace, message, onTaskUpdated, t, task.id]);

  const handleRefresh = useCallback(async () => {
    setActionLoading('refresh');
    try {
      await loadWorkspace();
    } finally {
      setActionLoading('');
    }
  }, [loadWorkspace]);

  useEffect(() => {
    setActiveChunkIndex(0);
  }, [activeFile?.path, viewerMode]);

  useEffect(() => {
    if (viewerMode !== 'diff') {
      setDiffChunkCount(0);
      return;
    }
    setDiffChunkCount(diffViewportRef.current?.querySelectorAll('.hc-diff__hunk').length ?? 0);
  }, [activeFile?.diffHash, viewerMode, wrapLines, workspace?.capturedAt]);

  const moveChunk = useCallback((offset: -1 | 1) => {
    const hunks = Array.from(diffViewportRef.current?.querySelectorAll('.hc-diff__hunk') ?? []);
    if (!hunks.length) return;
    const nextIndex = (activeChunkIndex + offset + hunks.length) % hunks.length;
    const target = hunks[nextIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ block: 'start' });
    setActiveChunkIndex(nextIndex);
  }, [activeChunkIndex]);

  const stagedSuggestion = useMemo(() => buildSuggestedCommitMessage(t, stagedFiles), [stagedFiles, t]);
  const selectedStagePaths = useMemo(
    () =>
      selectionFiles
        .filter((file) => file.sections.includes('unstaged') || file.sections.includes('untracked'))
        .map((file) => file.path),
    [selectionFiles]
  );
  const selectedUnstagePaths = useMemo(
    () => selectionFiles.filter((file) => file.sections.includes('staged')).map((file) => file.path),
    [selectionFiles]
  );
  const selectedDiscardPaths = useMemo(
    () =>
      selectionFiles
        .filter((file) => (file.sections.includes('staged') || file.sections.includes('unstaged')) && !file.sections.includes('untracked'))
        .map((file) => file.path),
    [selectionFiles]
  );
  const selectedDeletePaths = useMemo(
    () => selectionFiles.filter((file) => file.sections.includes('untracked')).map((file) => file.path),
    [selectionFiles]
  );

  const toggleFileSelected = useCallback((path: string) => {
    setSelectedPaths((current) => (current.includes(path) ? current.filter((item) => item !== path) : [...current, path]));
  }, []);

  const togglePreviewPath = useCallback((path: string) => {
    setPreviewPath((current) => (current === path ? '' : path));
  }, []);

  const selectVisibleFiles = useCallback(() => {
    if (!filteredFiles.length) return;
    setSelectedPaths((current) => Array.from(new Set([...current, ...filteredFiles.map((file) => file.path)])));
  }, [filteredFiles]);

  const clearSelectedFiles = useCallback(() => {
    setSelectedPaths([]);
  }, []);

  const runScopedWorkspaceAction = useCallback(
    async (action: TaskWorkspaceOperation) => {
      if (!workspace) return;
      if (!hasSelection) {
        await runWorkspaceAction(action);
        return;
      }

      const scopedPaths =
        action === 'stage'
          ? selectedStagePaths
          : action === 'unstage'
            ? selectedUnstagePaths
            : action === 'discard'
              ? selectedDiscardPaths
              : action === 'delete_untracked'
                ? selectedDeletePaths
                : [];
      if (!scopedPaths.length) return;
      await runWorkspaceAction(action, { paths: scopedPaths });
    },
    [hasSelection, runWorkspaceAction, selectedDeletePaths, selectedDiscardPaths, selectedStagePaths, selectedUnstagePaths, workspace]
  );

  const destructiveConfirmTitle = useCallback(
    (kind: ConfirmKind, scope: 'selection' | 'all' | 'file', value?: string) => {
      if (kind === 'discard') {
        if (scope === 'file') return t('tasks.gitWorkspace.confirm.discardFile', { path: value ?? '' });
        if (scope === 'selection') return t('tasks.gitWorkspace.confirm.discardSelection', { count: selectedDiscardPaths.length });
        return t('tasks.gitWorkspace.confirm.discardAll');
      }
      if (scope === 'file') return t('tasks.gitWorkspace.confirm.deleteFile', { path: value ?? '' });
      if (scope === 'selection') return t('tasks.gitWorkspace.confirm.deleteSelection', { count: selectedDeletePaths.length });
      return t('tasks.gitWorkspace.confirm.deleteAll');
    },
    [selectedDeletePaths.length, selectedDiscardPaths.length, t]
  );
  const commitPreviewMessage = useMemo(() => truncateSingleLine(commitMessage), [commitMessage]);
  const commitConfirmTitle = useMemo(
    () => t('tasks.gitWorkspace.confirm.commit', { count: workspace?.summary.staged ?? stagedFiles.length }),
    [stagedFiles.length, t, workspace?.summary.staged]
  );
  const pushConfirmTitle = useMemo(
    () =>
      t('tasks.gitWorkspace.confirm.push', {
        branch: workspace?.branch || 'HEAD',
        target: workspace?.upstream || workspace?.branch || 'origin'
      }),
    [t, workspace?.branch, workspace?.upstream]
  );
  const handleCommit = useCallback(async () => {
    const nextMessage = commitMessage.trim();
    if (!nextMessage || isReadOnly || !workspace?.canCommit) return;
    await runWorkspaceAction('commit', { message: nextMessage }, { clearCommit: true });
  }, [commitMessage, isReadOnly, runWorkspaceAction, workspace?.canCommit]);

  const handleCommitKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      void handleCommit();
    },
    [handleCommit]
  );

  if (loading && !workspace) {
    return (
      <div className="hc-git-workspace hc-git-workspace--loading">
        <Spin indicator={<LoadingOutlined spin />} />
      </div>
    );
  }

  if (!workspace || (!workspace.files.length && !error)) {
    return (
      <div className="hc-git-workspace">
        <div className="hc-git-workspace__header">
          <div>
            <div className="hc-git-workspace__eyebrow">{t('tasks.gitWorkspace.eyebrow')}</div>
            <div className="hc-git-workspace__title">{t('tasks.gitWorkspace.title')}</div>
          </div>
          <Button icon={<SyncOutlined />} onClick={() => void handleRefresh()} loading={actionLoading === 'refresh'}>
            {t('tasks.gitWorkspace.actions.refresh')}
          </Button>
        </div>
        {error ? <Alert type="warning" showIcon message={error} /> : <Empty description={t('tasks.gitWorkspace.empty')} />}
      </div>
    );
  }

  const activeFileCanStage = Boolean(activeFile?.sections.includes('unstaged') || activeFile?.sections.includes('untracked'));
  const activeFileCanUnstage = Boolean(activeFile?.sections.includes('staged'));
  const activeFileCanDiscard = Boolean(
    activeFile &&
      (activeFile.sections.includes('staged') || activeFile.sections.includes('unstaged')) &&
      !activeFile.sections.includes('untracked')
  );
  const activeFileCanDelete = Boolean(activeFile?.sections.includes('untracked'));
  const bulkStageDisabled = isReadOnly || (hasSelection ? selectedStagePaths.length === 0 : workspace.summary.unstaged + workspace.summary.untracked === 0);
  const bulkUnstageDisabled = isReadOnly || (hasSelection ? selectedUnstagePaths.length === 0 : workspace.summary.staged === 0);
  const bulkDiscardDisabled = isReadOnly || (hasSelection ? selectedDiscardPaths.length === 0 : workspace.summary.staged + workspace.summary.unstaged === 0);
  const bulkDeleteDisabled = isReadOnly || (hasSelection ? selectedDeletePaths.length === 0 : workspace.summary.untracked === 0);
  const legendKinds = ['create', 'update', 'delete'] as const;

  return (
    <section className="hc-git-workspace" aria-label={t('tasks.gitWorkspace.title')}>
      <header className="hc-git-workspace__header">
        <div>
          <div className="hc-git-workspace__eyebrow">{t('tasks.gitWorkspace.eyebrow')}</div>
          <div className="hc-git-workspace__title-row">
            <h3 className="hc-git-workspace__title">{t('tasks.gitWorkspace.title')}</h3>
            <Tag color={workspace.live ? 'processing' : 'default'}>{workspace.live ? t('tasks.gitWorkspace.live') : t('tasks.gitWorkspace.snapshot')}</Tag>
            {workspace.readOnly ? <Tag>{t('tasks.gitWorkspace.readOnly')}</Tag> : null}
          </div>
          <div className="hc-git-workspace__meta">
            <span>{workspace.branch || 'HEAD'}</span>
            {workspace.headSha ? <span>{workspace.headSha.slice(0, 8)}</span> : null}
            {workspace.upstream ? <span>{t('tasks.gitWorkspace.meta.upstream', { value: workspace.upstream })}</span> : null}
            {typeof workspace.ahead === 'number' || typeof workspace.behind === 'number' ? (
              <span>{t('tasks.gitWorkspace.meta.divergence', { ahead: workspace.ahead ?? 0, behind: workspace.behind ?? 0 })}</span>
            ) : null}
            <span>{t(`tasks.gitWorkspace.source.${workspace.source}` as never)}</span>
            <span>{t('tasks.gitWorkspace.count', { count: workspace.summary.total })}</span>
            <span>{t('tasks.workspaceChanges.updatedAt', { value: new Date(workspace.capturedAt).toLocaleTimeString() })}</span>
          </div>
        </div>

        <div className="hc-git-workspace__toolbar">
          <Button
            icon={<SyncOutlined />}
            onClick={() => void handleRefresh()}
            loading={actionLoading === 'refresh'}
          >
            {t('tasks.gitWorkspace.actions.refresh')}
          </Button>
          {canPush ? (
            <Popconfirm
              title={pushConfirmTitle}
              description={workspace?.upstream ? t('tasks.gitWorkspace.confirm.pushTarget', { value: workspace.upstream }) : undefined}
              onConfirm={() => void handlePush()}
            >
              <Button
                icon={<CloudUploadOutlined />}
                type="primary"
                loading={actionLoading === 'push'}
              >
                {t('tasks.gitWorkspace.actions.push')}
              </Button>
            </Popconfirm>
          ) : null}
        </div>
      </header>

      <div className="hc-git-workspace__stats">
        <div className="hc-git-workspace__stat-card">
          <span className="hc-git-workspace__stat-label">{t('tasks.gitWorkspace.section.staged')}</span>
          <strong>{workspace.summary.staged}</strong>
        </div>
        <div className="hc-git-workspace__stat-card">
          <span className="hc-git-workspace__stat-label">{t('tasks.gitWorkspace.section.unstaged')}</span>
          <strong>{workspace.summary.unstaged}</strong>
        </div>
        <div className="hc-git-workspace__stat-card">
          <span className="hc-git-workspace__stat-label">{t('tasks.gitWorkspace.section.untracked')}</span>
          <strong>{workspace.summary.untracked}</strong>
        </div>
        <div className="hc-git-workspace__stat-card">
          <span className="hc-git-workspace__stat-label">{t('tasks.gitWorkspace.section.lines')}</span>
          <strong>{`+${workspace.summary.additions} / -${workspace.summary.deletions}`}</strong>
        </div>
      </div>

      {isProcessing ? <Alert type="info" showIcon message={t('tasks.gitWorkspace.processingHint')} /> : null}
      {workspace.readOnly && !isProcessing ? <Alert type="warning" showIcon message={t('tasks.gitWorkspace.snapshotHint')} /> : null}
      {error ? <Alert type="warning" showIcon message={error} /> : null}

      <div className="hc-git-workspace__surface">
        <aside className="hc-git-workspace__rail">
          <label className="hc-git-workspace__search">
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t('tasks.gitWorkspace.search')}
              aria-label={t('tasks.gitWorkspace.search')}
            />
          </label>

          <div className="hc-git-workspace__selection-toolbar">
            <span className="hc-git-workspace__selection-count">{t('tasks.gitWorkspace.selection.count', { count: selectedPaths.length })}</span>
            <div className="hc-git-workspace__selection-toolbar-actions">
              <Button size="small" disabled={!filteredFiles.length} onClick={selectVisibleFiles}>
                {t('tasks.gitWorkspace.selection.selectVisible')}
              </Button>
              <Button size="small" disabled={!selectedPaths.length} onClick={clearSelectedFiles}>
                {t('tasks.gitWorkspace.selection.clear')}
              </Button>
            </div>
          </div>

          <div className="hc-git-workspace__legend">
            {legendKinds.map((kind) => (
              <span key={kind} className="hc-git-workspace__legend-item">
                <span
                  className={`hc-git-workspace__kind-badge hc-git-workspace__kind-badge--${kind}`}
                  aria-hidden="true"
                >
                  {getKindShortLabel(kind)}
                </span>
                <span>{t(getKindLabelKey(kind) as never)}</span>
              </span>
            ))}
          </div>

          <div className="hc-git-workspace__bulk-actions">
            <Button size="small" icon={<SaveOutlined />} disabled={bulkStageDisabled} onClick={() => void runScopedWorkspaceAction('stage')}>
              {t(hasSelection ? 'tasks.gitWorkspace.actions.stageSelected' : 'tasks.gitWorkspace.actions.stageAll')}
            </Button>
            <Button size="small" icon={<RollbackOutlined />} disabled={bulkUnstageDisabled} onClick={() => void runScopedWorkspaceAction('unstage')}>
              {t(hasSelection ? 'tasks.gitWorkspace.actions.unstageSelected' : 'tasks.gitWorkspace.actions.unstageAll')}
            </Button>
            <Popconfirm
              title={destructiveConfirmTitle('discard', hasSelection ? 'selection' : 'all')}
              disabled={bulkDiscardDisabled}
              onConfirm={() => void runScopedWorkspaceAction('discard')}
            >
              <span>
                <Button size="small" icon={<ScissorOutlined />} disabled={bulkDiscardDisabled}>
                  {t(hasSelection ? 'tasks.gitWorkspace.actions.discardSelected' : 'tasks.gitWorkspace.actions.discardTracked')}
                </Button>
              </span>
            </Popconfirm>
            <Popconfirm
              title={destructiveConfirmTitle('delete_untracked', hasSelection ? 'selection' : 'all')}
              disabled={bulkDeleteDisabled}
              onConfirm={() => void runScopedWorkspaceAction('delete_untracked')}
            >
              <span>
                <Button size="small" icon={<DeleteOutlined />} danger disabled={bulkDeleteDisabled}>
                  {t(hasSelection ? 'tasks.gitWorkspace.actions.deleteSelected' : 'tasks.gitWorkspace.actions.deleteUntracked')}
                </Button>
              </span>
            </Popconfirm>
          </div>

          <div className="hc-git-workspace__groups">
            {groupedFiles.map((group) => (
              <section key={group.key} className="hc-git-workspace__group">
                <div className="hc-git-workspace__group-header">
                  <span>{t(`tasks.gitWorkspace.section.${group.key}` as never)}</span>
                  <span>{group.files.length}</span>
                </div>
                {group.files.length === 0 ? (
                  <div className="hc-git-workspace__group-empty">{t('tasks.gitWorkspace.section.empty')}</div>
                ) : (
                  group.files.map((file) => {
                    const stats = calculateUnifiedDiffStats(file.unifiedDiff);
                    const isActive = activeFile?.path === file.path;
                    const isSelected = selectedPathSet.has(file.path);
                    const isPreviewOpen = previewPath === file.path;
                    const inlinePreview = buildInlineDiffPreview(file.unifiedDiff);
                    return (
                      <div
                        key={`${group.key}:${file.path}`}
                        className={`hc-git-workspace__file ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`.trim()}
                      >
                        <span className="hc-git-workspace__file-check">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFileSelected(file.path)}
                            aria-label={t('tasks.gitWorkspace.actions.selectFile', { path: file.path })}
                          />
                        </span>
                        <div className="hc-git-workspace__file-content">
                          <div className="hc-git-workspace__file-row">
                            <button
                              type="button"
                              className="hc-git-workspace__file-hit"
                              onClick={() => setActivePath(file.path)}
                            >
                              <span className="hc-git-workspace__file-main">
                                <span className="hc-git-workspace__file-headline">
                                  <span
                                    className={`hc-git-workspace__kind-badge hc-git-workspace__kind-badge--${file.kind ?? 'update'}`}
                                    title={t(getKindLabelKey(file.kind) as never)}
                                  >
                                    {getKindShortLabel(file.kind)}
                                  </span>
                                  <span className="hc-git-workspace__file-name">{getBaseName(file.path)}</span>
                                </span>
                                <span className="hc-git-workspace__file-path">{formatCompactPath(file.path)}</span>
                              </span>
                              <span className="hc-git-workspace__file-meta">
                                <span className="hc-git-workspace__file-sections">
                                  {file.sections.map((section) => (
                                    <span key={`${file.path}:${section}`} className={`hc-git-workspace__section-pill hc-git-workspace__section-pill--${section}`}>
                                      {t(`tasks.gitWorkspace.section.${section}` as never)}
                                    </span>
                                  ))}
                                </span>
                                <span className="hc-git-workspace__file-stats">{`+${stats.additions} -${stats.deletions}`}</span>
                              </span>
                            </button>
                            <Button
                              size="small"
                              type={isPreviewOpen ? 'primary' : 'default'}
                              icon={isPreviewOpen ? <DownOutlined /> : <RightOutlined />}
                              onClick={() => togglePreviewPath(file.path)}
                            >
                              {t(isPreviewOpen ? 'tasks.gitWorkspace.preview.hide' : 'tasks.gitWorkspace.preview.show')}
                            </Button>
                          </div>
                          {isPreviewOpen ? (
                            <div className="hc-git-workspace__inline-preview">
                              {inlinePreview.text ? (
                                <>
                                  <pre className={`hc-git-workspace__inline-preview-code ${wrapLines ? 'is-wrap' : 'is-nowrap'}`}>{inlinePreview.text}</pre>
                                  {inlinePreview.truncated ? <div className="hc-git-workspace__inline-preview-more">{t('tasks.gitWorkspace.preview.truncated')}</div> : null}
                                </>
                              ) : (
                                <div className="hc-git-workspace__inline-preview-empty">{t('tasks.workspaceChanges.diffUnavailable')}</div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            ))}
          </div>
        </aside>

        <div className="hc-git-workspace__viewer">
          {activeFile ? (
            <>
              <div className="hc-git-workspace__viewer-header">
                <div>
                  <div className="hc-git-workspace__viewer-path">{activeFile.path}</div>
                  <div className="hc-git-workspace__viewer-subtitle">
                    <Space size={8} wrap>
                      <span
                        className={`hc-git-workspace__kind-badge hc-git-workspace__kind-badge--${activeFile.kind ?? 'update'}`}
                        title={t(getKindLabelKey(activeFile.kind) as never)}
                      >
                        {getKindShortLabel(activeFile.kind)}
                      </span>
                      {activeFile.sections.map((section) => (
                        <span key={`${activeFile.path}:${section}`} className={`hc-git-workspace__section-pill hc-git-workspace__section-pill--${section}`}>
                          {t(`tasks.gitWorkspace.section.${section}` as never)}
                        </span>
                      ))}
                      <span className="hc-git-workspace__viewer-lines">{`+${activeFileStats.additions} -${activeFileStats.deletions}`}</span>
                    </Space>
                  </div>
                </div>

                <div className="hc-git-workspace__viewer-actions">
                  <Button icon={<DiffOutlined />} type={viewerMode === 'diff' ? 'primary' : 'default'} onClick={() => setViewerMode('diff')}>
                    {t('tasks.gitWorkspace.viewer.diff')}
                  </Button>
                  <Button icon={<FileTextOutlined />} type={viewerMode === 'file' ? 'primary' : 'default'} onClick={() => setViewerMode('file')}>
                    {t('tasks.gitWorkspace.viewer.file')}
                  </Button>
                  <Button onClick={() => setWrapLines((current) => !current)}>{wrapLines ? t('tasks.gitWorkspace.viewer.wrapOn') : t('tasks.gitWorkspace.viewer.wrapOff')}</Button>
                  <Button disabled={viewerMode !== 'diff' || diffChunkCount === 0} onClick={() => moveChunk(-1)}>
                    {t('tasks.gitWorkspace.viewer.prevChunk')}
                  </Button>
                  <Button disabled={viewerMode !== 'diff' || diffChunkCount === 0} onClick={() => moveChunk(1)}>
                    {t('tasks.gitWorkspace.viewer.nextChunk')}
                  </Button>
                </div>
              </div>

              <div className="hc-git-workspace__selection-actions">
                <Button size="small" icon={<SaveOutlined />} disabled={isReadOnly || !activeFileCanStage} loading={actionLoading === 'stage'} onClick={() => void runWorkspaceAction('stage', { paths: activeFile ? [activeFile.path] : [] })}>
                  {t('tasks.gitWorkspace.actions.stageFile')}
                </Button>
                <Button size="small" icon={<RollbackOutlined />} disabled={isReadOnly || !activeFileCanUnstage} loading={actionLoading === 'unstage'} onClick={() => void runWorkspaceAction('unstage', { paths: activeFile ? [activeFile.path] : [] })}>
                  {t('tasks.gitWorkspace.actions.unstageFile')}
                </Button>
                <Popconfirm
                  title={destructiveConfirmTitle('discard', 'file', activeFile?.path)}
                  disabled={isReadOnly || !activeFileCanDiscard}
                  onConfirm={() => void runWorkspaceAction('discard', { paths: activeFile ? [activeFile.path] : [] })}
                >
                  <span>
                    <Button size="small" icon={<ScissorOutlined />} disabled={isReadOnly || !activeFileCanDiscard} loading={actionLoading === 'discard'}>
                      {t('tasks.gitWorkspace.actions.discardFile')}
                    </Button>
                  </span>
                </Popconfirm>
                <Popconfirm
                  title={destructiveConfirmTitle('delete_untracked', 'file', activeFile?.path)}
                  disabled={isReadOnly || !activeFileCanDelete}
                  onConfirm={() => void runWorkspaceAction('delete_untracked', { paths: activeFile ? [activeFile.path] : [] })}
                >
                  <span>
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={isReadOnly || !activeFileCanDelete} loading={actionLoading === 'delete_untracked'}>
                      {t('tasks.gitWorkspace.actions.deleteFile')}
                    </Button>
                  </span>
                </Popconfirm>
              </div>

              <div className="hc-git-workspace__viewer-body" ref={diffViewportRef}>
                {viewerMode === 'diff' ? (
                  <DiffView
                    oldText={activeFile.oldText ?? ''}
                    newText={activeFile.newText ?? ''}
                    unifiedDiff={activeFile.unifiedDiff}
                    wrapLines={wrapLines}
                    className="hc-git-workspace__diff"
                  />
                ) : (
                  <TextPreviewBlock
                    text={activeFile.newText ?? activeFile.oldText ?? activeFile.unifiedDiff ?? ''}
                    limits={RAW_TEXT_PREVIEW_LIMITS}
                    className={`hc-git-workspace__text-preview ${wrapLines ? 'is-wrap' : 'is-nowrap'}`}
                    codeClassName="hc-task-code-block hc-task-code-block--expanded"
                  />
                )}
              </div>
            </>
          ) : (
            <Empty description={t('tasks.gitWorkspace.emptyFiltered')} />
          )}
        </div>
      </div>

      <footer className="hc-git-workspace__composer">
        <div className="hc-git-workspace__composer-header">
          <div className="hc-git-workspace__composer-copy">
            <Typography.Text strong>{t('tasks.gitWorkspace.commit.title')}</Typography.Text>
            <Typography.Text type="secondary">{t('tasks.gitWorkspace.commit.description')}</Typography.Text>
            {!composerCollapsed ? <Typography.Text type="secondary">{t('tasks.gitWorkspace.commit.shortcut')}</Typography.Text> : null}
          </div>
          <Button size="small" onClick={() => setComposerCollapsed((current) => !current)}>
            {t(composerCollapsed ? 'tasks.gitWorkspace.commit.expand' : 'tasks.gitWorkspace.commit.collapse')}
          </Button>
        </div>
        {!composerCollapsed ? (
          <>
            <Input.TextArea
              rows={3}
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              onKeyDown={handleCommitKeyDown}
              placeholder={t('tasks.gitWorkspace.commit.placeholder')}
              disabled={isReadOnly}
            />
            <div className="hc-git-workspace__composer-actions">
              <Button onClick={() => setCommitMessage(stagedSuggestion)} disabled={isReadOnly || !stagedFiles.length}>
                {t('tasks.gitWorkspace.commit.suggest')}
              </Button>
              <Popconfirm
                title={commitConfirmTitle}
                description={commitPreviewMessage ? t('tasks.gitWorkspace.confirm.commitMessage', { value: commitPreviewMessage }) : undefined}
                disabled={isReadOnly || !workspace.canCommit || !commitMessage.trim()}
                onConfirm={() => void handleCommit()}
              >
                <span>
                  <Button
                    type="primary"
                    icon={<CloudUploadOutlined />}
                    disabled={isReadOnly || !workspace.canCommit || !commitMessage.trim()}
                    loading={actionLoading === 'commit'}
                  >
                    {t('tasks.gitWorkspace.commit.action')}
                  </Button>
                </span>
              </Popconfirm>
            </div>
          </>
        ) : null}
      </footer>
    </section>
  );
};
