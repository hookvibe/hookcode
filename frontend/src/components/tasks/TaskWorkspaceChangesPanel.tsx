import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent } from 'react';
import type { TaskWorkspaceChange, TaskWorkspaceChanges } from '../../api';
import { useT } from '../../i18n';
import { TextPreviewBlock } from '../TextPreviewBlock';
import { DiffView } from '../diff/DiffView';
import { calculateUnifiedDiff, calculateUnifiedDiffStats } from '../diff/calculateDiff';
import { buildTextPreview, INLINE_DIFF_PREVIEW_LIMITS, RAW_TEXT_PREVIEW_LIMITS } from '../../utils/textPreview';

type BadgeTone = 'default' | 'create' | 'delete';
type ChangeStats = { additions: number; deletions: number };

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

export const TaskWorkspaceChangesPanel: FC<{
  changes?: TaskWorkspaceChanges | null;
}> = ({ changes }) => {
  const t = useT();
  const [wrapLines, setWrapLines] = useState(true);
  const fileButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Normalize the latest worker snapshot into a stable file list before rendering the ClaudeCodeUI-style diff surface. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  const files = useMemo(
    () => (Array.isArray(changes?.files) ? changes?.files.filter((file) => String(file?.path ?? '').trim()) : []),
    [changes?.files]
  );
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const fileDecorations = useMemo(
    () =>
      new Map(
        files.map((file) => [
          file.path,
          {
            badge: resolveBadge(file),
            stats: resolveChangeStats(file)
          }
        ])
      ),
    [files]
  );

  useEffect(() => {
    // Keep one diff visible by default so worker runs immediately show file content while preserving the user's active selection across live updates. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
    if (!files.length) {
      setExpandedPath(null);
      return;
    }
    if (expandedPath && files.some((file) => file.path === expandedPath)) return;
    setExpandedPath(files[0].path);
  }, [expandedPath, files]);

  useEffect(() => {
    if (!expandedPath) return;
    const activeButton = fileButtonRefs.current[expandedPath];
    if (typeof activeButton?.scrollIntoView === 'function') {
      activeButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [expandedPath]);

  if (!files.length) return null;

  const activeFile = files.find((file) => file.path === expandedPath) ?? files[0];
  const updatedAtText = changes?.capturedAt ? new Date(changes.capturedAt).toLocaleTimeString() : '';
  const activeDisplayPath = formatCompactPath(activeFile.path);
  const activeDecoration = fileDecorations.get(activeFile.path) ?? {
    badge: resolveBadge(activeFile),
    stats: resolveChangeStats(activeFile)
  };
  const activeBadge = activeDecoration.badge;
  const activeStats = activeDecoration.stats;
  const activateFile = (nextPath: string, focusButton: boolean = false) => {
    if (focusButton) {
      fileButtonRefs.current[nextPath]?.focus?.();
    }
    setExpandedPath(nextPath);
  };
  const handleFileKeyDown = (event: KeyboardEvent<HTMLButtonElement>, filePath: string) => {
    const activeIndex = files.findIndex((file) => file.path === filePath);
    if (activeIndex === -1) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      activateFile(files[Math.min(activeIndex + 1, files.length - 1)]?.path ?? filePath, true);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      activateFile(files[Math.max(activeIndex - 1, 0)]?.path ?? filePath, true);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      activateFile(files[0]?.path ?? filePath, true);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      activateFile(files[files.length - 1]?.path ?? filePath, true);
    }
  };

  return (
    <section className="hc-workspace-changes" aria-label={t('tasks.workspaceChanges.title')}>
      <div className="hc-workspace-changes__header">
        <div>
          <div className="hc-workspace-changes__eyebrow">{t('tasks.workspaceChanges.title')}</div>
          <div className="hc-workspace-changes__title-row">
            <div className="hc-workspace-changes__title" title={activeFile.path}>{activeDisplayPath}</div>
            <span className={`hc-workspace-changes__header-badge hc-workspace-changes__header-badge--${activeBadge.tone}`}>
              {activeBadge.code}
            </span>
          </div>
          <div className="hc-workspace-changes__meta">
            {t('tasks.workspaceChanges.count', { count: files.length })}
            {updatedAtText ? ` · ${t('tasks.workspaceChanges.updatedAt', { value: updatedAtText })}` : ''}
          </div>
          <div className="hc-workspace-changes__summary">
            <span className={`hc-workspace-changes__summary-chip hc-workspace-changes__summary-chip--${activeBadge.tone}`}>{t(activeBadge.labelKey)}</span>
            {activeStats.additions > 0 ? <span className="hc-workspace-changes__summary-chip hc-workspace-changes__summary-chip--add">{`+${activeStats.additions}`}</span> : null}
            {activeStats.deletions > 0 ? <span className="hc-workspace-changes__summary-chip hc-workspace-changes__summary-chip--remove">{`-${activeStats.deletions}`}</span> : null}
          </div>
        </div>
      </div>

      <div className="hc-workspace-changes__layout">
        <div className="hc-workspace-changes__files" role="tablist" aria-label={t('tasks.workspaceChanges.title')}>
          {files.map((file) => {
            const decoration = fileDecorations.get(file.path) ?? { badge: resolveBadge(file), stats: resolveChangeStats(file) };
            const badge = decoration.badge;
            const stats = decoration.stats;
            const expanded = activeFile.path === file.path;
            const compactPath = formatCompactPath(file.path);
            return (
              <button
                key={`${file.path}:${file.diffHash}`}
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
                <span className={`hc-workspace-changes__file-code hc-workspace-changes__file-code--${badge.tone}`}>{badge.code}</span>
                <span className="hc-workspace-changes__file-copy">
                  <span className="hc-workspace-changes__file-path" title={file.path}>{compactPath}</span>
                  <span className="hc-workspace-changes__file-meta">
                    <span className={`hc-workspace-changes__file-label hc-workspace-changes__file-label--${badge.tone}`}>{t(badge.labelKey)}</span>
                    {stats.additions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--add">{`+${stats.additions}`}</span> : null}
                    {stats.deletions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--remove">{`-${stats.deletions}`}</span> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="hc-workspace-changes__viewer">
          <div className="hc-workspace-changes__diff-card">
            <div className="hc-workspace-changes__diff-header">
              <div className="hc-workspace-changes__diff-main">
                <span className="hc-workspace-changes__diff-path" title={activeFile.path}>{activeDisplayPath}</span>
                {updatedAtText ? <span className="hc-workspace-changes__diff-meta">{t('tasks.workspaceChanges.updatedAt', { value: updatedAtText })}</span> : null}
              </div>
              <div className="hc-workspace-changes__diff-summary">
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
                <span className={`hc-workspace-changes__diff-badge hc-workspace-changes__diff-badge--${activeBadge.tone}`}>
                  {t(activeBadge.labelKey)}
                </span>
                {activeStats.additions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--add">{`+${activeStats.additions}`}</span> : null}
                {activeStats.deletions > 0 ? <span className="hc-workspace-changes__metric hc-workspace-changes__metric--remove">{`-${activeStats.deletions}`}</span> : null}
              </div>
            </div>
            <div className="hc-workspace-changes__diff-body">
              {activeFile.oldText !== undefined || activeFile.newText !== undefined ? (
                <DiffView
                  oldText={activeFile.oldText ?? ''}
                  newText={activeFile.newText ?? ''}
                  unifiedDiff={activeFile.unifiedDiff}
                  showLineNumbers
                  showPlusMinusSymbols
                  wrapLines={wrapLines}
                />
              ) : (
                <TextPreviewBlock
                  text={activeFile.unifiedDiff}
                  emptyText={t('tasks.workspaceChanges.diffUnavailable')}
                  limits={RAW_TEXT_PREVIEW_LIMITS}
                  className={`hc-workspace-changes__text-preview ${wrapLines ? 'is-wrap' : 'is-nowrap'}`}
                  codeClassName="hc-task-code-block hc-task-code-block--expanded"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
