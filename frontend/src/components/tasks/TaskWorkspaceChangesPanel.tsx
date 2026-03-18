import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent } from 'react';
import type { TaskWorkspaceChange, TaskWorkspaceChanges } from '../../api';
import { useT } from '../../i18n';
import { TextPreviewBlock } from '../TextPreviewBlock';
import { DiffView } from '../diff/DiffView';
import { calculateUnifiedDiff, calculateUnifiedDiffStats } from '../diff/calculateDiff';
import { buildTextPreview, INLINE_DIFF_PREVIEW_LIMITS, RAW_TEXT_PREVIEW_LIMITS } from '../../utils/textPreview';
import '../../styles/workspace-changes.css';

type BadgeTone = 'default' | 'create' | 'delete';
type ChangeStats = { additions: number; deletions: number };
type WorkspaceStatusFilter = 'all' | 'create' | 'update' | 'delete';
type WorkspaceGroupKey = Exclude<WorkspaceStatusFilter, 'all'>;

type WorkspaceFileModel = {
  file: TaskWorkspaceChange;
  path: string;
  displayPath: string;
  badge: { labelKey: string; tone: BadgeTone; code: 'A' | 'M' | 'D' };
  stats: ChangeStats;
  kindKey: WorkspaceGroupKey;
  totalChanges: number;
  searchText: string;
};

const LARGE_CHANGE_THRESHOLD = 40;
const GROUP_ORDER: WorkspaceGroupKey[] = ['create', 'update', 'delete'];

const resolveBadge = (file: TaskWorkspaceChange): { labelKey: string; tone: BadgeTone; code: 'A' | 'M' | 'D' } => {
  if (file.kind === 'create') return { labelKey: 'tasks.workspaceChanges.badge.create', tone: 'create', code: 'A' };
  if (file.kind === 'delete') return { labelKey: 'tasks.workspaceChanges.badge.delete', tone: 'delete', code: 'D' };
  return { labelKey: 'tasks.workspaceChanges.badge.update', tone: 'default', code: 'M' };
};

const resolveStatsFromUnifiedDiff = (unifiedDiff: string): ChangeStats => calculateUnifiedDiffStats(unifiedDiff);

const resolveChangeStats = (file: TaskWorkspaceChange): ChangeStats => {
  // Derive compact +/- summaries locally so the Claude-style file rail can expose change magnitude without any backend contract change. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  if (String(file.unifiedDiff ?? '').trim()) {
    const stats = resolveStatsFromUnifiedDiff(file.unifiedDiff);
    if (stats.additions > 0 || stats.deletions > 0 || (typeof file.oldText !== 'string' && typeof file.newText !== 'string')) {
      return stats;
    }
  }
  if (typeof file.oldText === 'string' || typeof file.newText === 'string') {
    const oldPreview = buildTextPreview(file.oldText ?? '', INLINE_DIFF_PREVIEW_LIMITS);
    const newPreview = buildTextPreview(file.newText ?? '', INLINE_DIFF_PREVIEW_LIMITS);
    return calculateUnifiedDiff(oldPreview.text, newPreview.text, 0).stats;
  }
  return { additions: 0, deletions: 0 };
};

const formatCompactPath = (rawPath: string, maxSegments: number = 3): string => {
  // Prefer the trailing path segments so dense worker diff cards keep the actionable filename visible in narrow layouts. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  const normalizedPath = String(rawPath ?? '').trim();
  if (!normalizedPath) return normalizedPath;
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  if (segments.length <= maxSegments) return normalizedPath;
  return `.../${segments.slice(-maxSegments).join('/')}`;
};

const buildFileModel = (file: TaskWorkspaceChange): WorkspaceFileModel => {
  const badge = resolveBadge(file);
  const stats = resolveChangeStats(file);
  const kindKey: WorkspaceGroupKey = file.kind === 'create' ? 'create' : file.kind === 'delete' ? 'delete' : 'update';

  return {
    file,
    path: file.path,
    displayPath: formatCompactPath(file.path),
    badge,
    stats,
    kindKey,
    totalChanges: stats.additions + stats.deletions,
    searchText: `${file.path} ${file.kind ?? ''}`.toLowerCase()
  };
};

export const TaskWorkspaceChangesPanel: FC<{
  changes?: TaskWorkspaceChanges | null;
}> = ({ changes }) => {
  const t = useT();
  const [wrapLines, setWrapLines] = useState(true);
  const [statusFilter, setStatusFilter] = useState<WorkspaceStatusFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [largeOnly, setLargeOnly] = useState(false);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const fileButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Normalize the latest worker snapshot into a stable file list before rendering the ClaudeCodeUI-style diff surface. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  const files = useMemo(
    () => (Array.isArray(changes?.files) ? changes.files.filter((file) => String(file?.path ?? '').trim()) : []),
    [changes?.files]
  );
  const fileModels = useMemo(() => files.map((file) => buildFileModel(file)), [files]);
  const normalizedQuery = searchValue.trim().toLowerCase();

  const summary = useMemo(() => {
    return fileModels.reduce(
      (accumulator, file) => {
        accumulator.total += 1;
        accumulator[file.kindKey] += 1;
        accumulator.additions += file.stats.additions;
        accumulator.deletions += file.stats.deletions;
        return accumulator;
      },
      { total: 0, create: 0, update: 0, delete: 0, additions: 0, deletions: 0 }
    );
  }, [fileModels]);

  const filteredFiles = useMemo(() => {
    return fileModels.filter((file) => {
      if (statusFilter !== 'all' && file.kindKey !== statusFilter) return false;
      if (largeOnly && file.totalChanges < LARGE_CHANGE_THRESHOLD) return false;
      if (normalizedQuery && !file.searchText.includes(normalizedQuery)) return false;
      return true;
    });
  }, [fileModels, largeOnly, normalizedQuery, statusFilter]);

  const groupedFiles = useMemo(
    () =>
      GROUP_ORDER.map((key) => ({
        key,
        files: filteredFiles.filter((file) => file.kindKey === key)
      })).filter((group) => group.files.length > 0),
    [filteredFiles]
  );

  useEffect(() => {
    // Keep one diff visible by default so worker runs immediately show file content while preserving the user's active selection across live updates. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    if (!filteredFiles.length) {
      setExpandedPath(null);
      return;
    }
    if (expandedPath && filteredFiles.some((file) => file.path === expandedPath)) return;
    setExpandedPath(filteredFiles[0].path);
  }, [expandedPath, filteredFiles]);

  useEffect(() => {
    if (!expandedPath) return;
    const activeButton = fileButtonRefs.current[expandedPath];
    if (typeof activeButton?.scrollIntoView === 'function') {
      activeButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [expandedPath]);

  if (!fileModels.length) return null;

  const activeFile = filteredFiles.find((file) => file.path === expandedPath) ?? filteredFiles[0] ?? null;
  const updatedAtText = changes?.capturedAt ? new Date(changes.capturedAt).toLocaleTimeString() : '';
  const activeFilters = statusFilter !== 'all' || normalizedQuery.length > 0 || largeOnly;
  const filteredMeta =
    filteredFiles.length !== fileModels.length
      ? t('tasks.workspaceChanges.filtered', { visible: filteredFiles.length, total: fileModels.length })
      : '';
  const activeIndex = activeFile ? filteredFiles.findIndex((file) => file.path === activeFile.path) : -1;

  const activateFile = (nextPath: string, focusButton: boolean = false) => {
    if (focusButton) {
      fileButtonRefs.current[nextPath]?.focus?.();
    }
    setExpandedPath(nextPath);
  };

  const moveActiveSelection = (offset: -1 | 1, focusButton: boolean) => {
    if (!filteredFiles.length || activeIndex < 0) return;
    const nextIndex = (activeIndex + offset + filteredFiles.length) % filteredFiles.length;
    activateFile(filteredFiles[nextIndex].path, focusButton);
  };

  const handleFileKeyDown = (event: KeyboardEvent<HTMLButtonElement>, filePath: string) => {
    const currentIndex = filteredFiles.findIndex((file) => file.path === filePath);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveActiveSelection(1, true);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      moveActiveSelection(-1, true);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      activateFile(filteredFiles[0]?.path ?? filePath, true);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      activateFile(filteredFiles[filteredFiles.length - 1]?.path ?? filePath, true);
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchValue('');
    setLargeOnly(false);
  };

  return (
    <section className="hc-workspace-changes" aria-label={t('tasks.workspaceChanges.title')}>
      <div className="hc-workspace-changes__header">
        <div className="hc-workspace-changes__eyebrow">{t('tasks.workspaceChanges.title')}</div>
        <div className="hc-workspace-changes__title-row">
          <div className="hc-workspace-changes__title" title={activeFile?.path ?? ''}>
            {activeFile?.displayPath ?? t('tasks.workspaceChanges.emptyFiltered')}
          </div>
          {activeFile ? (
            <span className={`hc-workspace-changes__header-badge hc-workspace-changes__header-badge--${activeFile.badge.tone}`}>
              {activeFile.badge.code}
            </span>
          ) : null}
        </div>
        <div className="hc-workspace-changes__meta">
          {t('tasks.workspaceChanges.count', { count: summary.total })}
          {updatedAtText ? ` · ${t('tasks.workspaceChanges.updatedAt', { value: updatedAtText })}` : ''}
          {filteredMeta ? ` · ${filteredMeta}` : ''}
        </div>

        <div className="hc-workspace-changes__summary">
          <span className="hc-workspace-changes__summary-chip">{`${t('tasks.workspaceChanges.badge.create')} ${summary.create}`}</span>
          <span className="hc-workspace-changes__summary-chip">{`${t('tasks.workspaceChanges.badge.update')} ${summary.update}`}</span>
          <span className="hc-workspace-changes__summary-chip">{`${t('tasks.workspaceChanges.badge.delete')} ${summary.delete}`}</span>
          {summary.additions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--add">{`+${summary.additions}`}</span> : null}
          {summary.deletions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--remove">{`-${summary.deletions}`}</span> : null}
        </div>

        <div className="hc-workspace-changes__legend">
          {GROUP_ORDER.map((key) => {
            const tone = key === 'create' ? 'create' : key === 'delete' ? 'delete' : 'default';
            const code = key === 'create' ? 'A' : key === 'delete' ? 'D' : 'M';
            const labelKey = key === 'create' ? 'tasks.workspaceChanges.badge.create' : key === 'delete' ? 'tasks.workspaceChanges.badge.delete' : 'tasks.workspaceChanges.badge.update';
            return (
              <span key={key} className="hc-workspace-changes__legend-item">
                <span className={`hc-workspace-changes__file-code hc-workspace-changes__file-code--${tone}`}>{code}</span>
                <span>{t(labelKey)}</span>
              </span>
            );
          })}
        </div>

        <div className="hc-workspace-changes__controls">
          <label className="hc-workspace-changes__search">
            <span className="hc-workspace-changes__search-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t('tasks.workspaceChanges.searchPlaceholder')}
              aria-label={t('tasks.workspaceChanges.searchPlaceholder')}
            />
          </label>

          <div className="hc-workspace-changes__filters" role="toolbar" aria-label={t('tasks.workspaceChanges.title')}>
            <button
              type="button"
              className={`hc-workspace-changes__filter${statusFilter === 'all' ? ' is-active' : ''}`}
              aria-pressed={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              {t('tasks.workspaceChanges.filter.all')}
            </button>
            <button
              type="button"
              className={`hc-workspace-changes__filter${statusFilter === 'create' ? ' is-active' : ''}`}
              aria-pressed={statusFilter === 'create'}
              onClick={() => setStatusFilter('create')}
            >
              {t('tasks.workspaceChanges.badge.create')}
            </button>
            <button
              type="button"
              className={`hc-workspace-changes__filter${statusFilter === 'update' ? ' is-active' : ''}`}
              aria-pressed={statusFilter === 'update'}
              onClick={() => setStatusFilter('update')}
            >
              {t('tasks.workspaceChanges.badge.update')}
            </button>
            <button
              type="button"
              className={`hc-workspace-changes__filter${statusFilter === 'delete' ? ' is-active' : ''}`}
              aria-pressed={statusFilter === 'delete'}
              onClick={() => setStatusFilter('delete')}
            >
              {t('tasks.workspaceChanges.badge.delete')}
            </button>
            <button
              type="button"
              className={`hc-workspace-changes__filter${largeOnly ? ' is-active' : ''}`}
              aria-pressed={largeOnly}
              onClick={() => setLargeOnly((current) => !current)}
            >
              {t('tasks.workspaceChanges.filter.large')}
            </button>
            {activeFilters ? (
              <button type="button" className="hc-workspace-changes__filter hc-workspace-changes__filter--ghost" onClick={resetFilters}>
                {t('tasks.workspaceChanges.actions.clearFilters')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hc-workspace-changes__layout">
        <div className="hc-workspace-changes__files" role="tablist" aria-label={t('tasks.workspaceChanges.title')}>
          {groupedFiles.length ? (
            groupedFiles.map((group) => (
              <section key={group.key} className="hc-workspace-changes__group" aria-label={t(`tasks.workspaceChanges.section.${group.key}` as never)}>
                <div className="hc-workspace-changes__group-header">
                  <span>{t(`tasks.workspaceChanges.section.${group.key}` as never)}</span>
                  <span className="hc-workspace-changes__group-count">{group.files.length}</span>
                </div>
                {group.files.map((file) => {
                  const expanded = activeFile?.path === file.path;
                  return (
                    <button
                      key={`${file.path}:${file.file.diffHash}`}
                      type="button"
                      ref={(node) => {
                        fileButtonRefs.current[file.path] = node;
                      }}
                      className={`hc-workspace-changes__file${expanded ? ' is-active' : ''}`}
                      aria-label={file.path}
                      aria-pressed={expanded}
                      tabIndex={expanded ? 0 : -1}
                      onClick={() => activateFile(file.path)}
                      onKeyDown={(event) => handleFileKeyDown(event, file.path)}
                    >
                      <span className={`hc-workspace-changes__file-code hc-workspace-changes__file-code--${file.badge.tone}`}>{file.badge.code}</span>
                      <span className="hc-workspace-changes__file-copy">
                        <span className="hc-workspace-changes__file-path" title={file.path}>
                          {file.displayPath}
                        </span>
                        <span className="hc-workspace-changes__file-meta">
                          <span className={`hc-workspace-changes__file-label hc-workspace-changes__file-label--${file.badge.tone}`}>{t(file.badge.labelKey)}</span>
                          {file.stats.additions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--add">{`+${file.stats.additions}`}</span> : null}
                          {file.stats.deletions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--remove">{`-${file.stats.deletions}`}</span> : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </section>
            ))
          ) : (
            <div className="hc-workspace-changes__empty">
              <span>{t('tasks.workspaceChanges.emptyFiltered')}</span>
              {activeFilters ? (
                <button type="button" className="hc-workspace-changes__filter hc-workspace-changes__filter--ghost" onClick={resetFilters}>
                  {t('tasks.workspaceChanges.actions.clearFilters')}
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="hc-workspace-changes__viewer">
          {activeFile ? (
            <div className="hc-workspace-changes__diff-card">
              <div className="hc-workspace-changes__diff-header">
                <div className="hc-workspace-changes__diff-main">
                  <span className="hc-workspace-changes__diff-path" title={activeFile.path}>
                    {activeFile.displayPath}
                  </span>
                  <span className="hc-workspace-changes__diff-meta">
                    {updatedAtText ? t('tasks.workspaceChanges.updatedAt', { value: updatedAtText }) : ''}
                    {filteredMeta ? ` · ${filteredMeta}` : ''}
                  </span>
                </div>
                <div className="hc-workspace-changes__diff-summary">
                  <button
                    type="button"
                    className="hc-workspace-changes__tool-btn"
                    onClick={() => moveActiveSelection(-1, true)}
                    disabled={filteredFiles.length <= 1}
                    aria-label={t('tasks.workspaceChanges.actions.previousFile')}
                    title={t('tasks.workspaceChanges.actions.previousFile')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="hc-workspace-changes__tool-btn"
                    onClick={() => moveActiveSelection(1, true)}
                    disabled={filteredFiles.length <= 1}
                    aria-label={t('tasks.workspaceChanges.actions.nextFile')}
                    title={t('tasks.workspaceChanges.actions.nextFile')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`hc-workspace-changes__tool-btn${wrapLines ? ' is-active' : ''}`}
                    onClick={() => setWrapLines((current) => !current)}
                    aria-pressed={wrapLines}
                    aria-label={t('tasks.workspaceChanges.actions.wrapLines')}
                    title={t('tasks.workspaceChanges.actions.wrapLines')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h10a4 4 0 1 1 0 8H9" />
                      <path d="M4 11h10" />
                      <path d="M9 15l-3 3-3-3" />
                    </svg>
                  </button>
                  <span className={`hc-workspace-changes__diff-badge hc-workspace-changes__diff-badge--${activeFile.badge.tone}`}>
                    {t(activeFile.badge.labelKey)}
                  </span>
                  {activeFile.stats.additions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--add">{`+${activeFile.stats.additions}`}</span> : null}
                  {activeFile.stats.deletions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--remove">{`-${activeFile.stats.deletions}`}</span> : null}
                </div>
              </div>
              <div className="hc-workspace-changes__diff-body">
                {activeFile.file.oldText !== undefined || activeFile.file.newText !== undefined ? (
                  <DiffView
                    oldText={activeFile.file.oldText ?? ''}
                    newText={activeFile.file.newText ?? ''}
                    unifiedDiff={activeFile.file.unifiedDiff}
                    showLineNumbers
                    showPlusMinusSymbols
                    wrapLines={wrapLines}
                  />
                ) : (
                  <TextPreviewBlock
                    text={activeFile.file.unifiedDiff}
                    emptyText={t('tasks.workspaceChanges.diffUnavailable')}
                    limits={RAW_TEXT_PREVIEW_LIMITS}
                    className={`hc-workspace-changes__text-preview ${wrapLines ? 'is-wrap' : 'is-nowrap'}`}
                    codeClassName="hc-task-code-block hc-task-code-block--expanded"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="hc-workspace-changes__diff-card hc-workspace-changes__diff-card--empty">
              <div className="hc-workspace-changes__empty">
                <span>{t('tasks.workspaceChanges.emptyFiltered')}</span>
                {activeFilters ? (
                  <button type="button" className="hc-workspace-changes__filter hc-workspace-changes__filter--ghost" onClick={resetFilters}>
                    {t('tasks.workspaceChanges.actions.clearFilters')}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
