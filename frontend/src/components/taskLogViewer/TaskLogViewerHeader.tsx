import type { TFunction } from '../../i18n';
import type { ViewerMode } from './timeline';

export type TaskLogViewerHeaderProps = {
  t: TFunction;
  connecting: boolean;
  error: string | null;
  logsCount: number;
  showLoadEarlier: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  showReconnectButton: boolean;
  onReconnect: () => void;
  mode: ViewerMode;
  onToggleMode: () => void;
  showReasoning: boolean;
  onToggleShowReasoning: (next: boolean) => void;
  wrapDiffLines: boolean;
  onToggleWrapDiffLines: (next: boolean) => void;
  showLineNumbers: boolean;
  onToggleShowLineNumbers: (next: boolean) => void;
  onCopy: () => void;
  onClear: () => void;
  clearing: boolean;
};

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);
const IconArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
);
const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="log-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
);
const IconCode = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
);
const IconSpark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path></svg>
);
const IconWrap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h10a4 4 0 1 1 0 8H9"></path><path d="M4 11h10"></path><path d="M9 15l-3 3-3-3"></path></svg>
);
const IconLines = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path><path d="M9 4v16"></path></svg>
);

export const TaskLogViewerHeader = ({
  t,
  connecting,
  error,
  logsCount,
  showLoadEarlier,
  loadingEarlier,
  onLoadEarlier,
  showReconnectButton,
  onReconnect,
  mode,
  onToggleMode,
  showReasoning,
  onToggleShowReasoning,
  wrapDiffLines,
  onToggleWrapDiffLines,
  showLineNumbers,
  onToggleShowLineNumbers,
  onCopy,
  onClear,
  clearing
}: TaskLogViewerHeaderProps) => (
  <div className="log-header">
    <div className="log-header__meta">
      <span className="log-header__eyebrow">{t('execViewer.title')}</span>
      <div className="log-header__summary">
        <span className={`log-header__status ${connecting ? 'is-connecting' : error ? 'is-error' : 'is-live'}`}>
          <span className="log-header__status-dot" />
          {connecting ? t('logViewer.state.connecting') : error ? t('logViewer.state.error') : t('logViewer.state.live')}
        </span>
        <span className="log-header__count">{t('logViewer.lines', { count: logsCount })}</span>
      </div>
    </div>

    <div className="log-header__toolbar">
      {/* Keep load-earlier visible for paged task log access in the tabbed workspace. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
      {showLoadEarlier && (
        <button type="button" className="log-btn log-btn--labelled" onClick={onLoadEarlier} disabled={loadingEarlier} title={t('logViewer.actions.loadEarlier')}>
          {loadingEarlier ? <IconSpinner /> : <IconArrowUp />}
          <span>{loadingEarlier ? t('logViewer.loading') : t('logViewer.actions.loadEarlier')}</span>
        </button>
      )}
      <div className="log-toolbar-group">
        {showReconnectButton && (
          <button type="button" className="log-btn" onClick={onReconnect} aria-label={t('logViewer.actions.reconnect')} title={t('logViewer.actions.reconnect')}>
            <IconRefresh />
          </button>
        )}
      </div>

      <div className="log-toolbar-group log-toolbar-group--segmented">
        <button
          type="button"
          className={`log-btn log-btn--icon-only${mode === 'timeline' ? ' is-active' : ''}`}
          onClick={mode === 'timeline' ? undefined : onToggleMode}
          disabled={mode === 'timeline'}
          aria-label={t('execViewer.actions.showTimeline')}
          title={t('execViewer.actions.showTimeline')}
        >
          <IconList />
        </button>
        <button
          type="button"
          className={`log-btn log-btn--icon-only${mode === 'raw' ? ' is-active' : ''}`}
          onClick={mode === 'raw' ? undefined : onToggleMode}
          disabled={mode === 'raw'}
          aria-label={t('execViewer.actions.showRaw')}
          title={t('execViewer.actions.showRaw')}
        >
          <IconCode />
        </button>
      </div>

      {mode === 'timeline' && (
        <div className="log-toolbar-group">
          <button
            type="button"
            className={`log-btn log-btn--icon-only${showReasoning ? ' is-active' : ''}`}
            onClick={() => onToggleShowReasoning(!showReasoning)}
            aria-label={t('execViewer.toggles.reasoning')}
            title={t('execViewer.toggles.reasoning')}
          >
            <IconSpark />
          </button>
          <button
            type="button"
            className={`log-btn log-btn--icon-only${wrapDiffLines ? ' is-active' : ''}`}
            onClick={() => onToggleWrapDiffLines(!wrapDiffLines)}
            aria-label={t('execViewer.toggles.wrapDiff')}
            title={t('execViewer.toggles.wrapDiff')}
          >
            <IconWrap />
          </button>
          <button
            type="button"
            className={`log-btn log-btn--icon-only${showLineNumbers ? ' is-active' : ''}`}
            onClick={() => onToggleShowLineNumbers(!showLineNumbers)}
            aria-label={t('execViewer.toggles.lineNumbers')}
            title={t('execViewer.toggles.lineNumbers')}
          >
            <IconLines />
          </button>
        </div>
      )}

      <div className="log-toolbar-group">
        <button type="button" className="log-btn" onClick={onCopy} aria-label={t('logViewer.actions.copy')} title={t('logViewer.actions.copy')}>
          <IconCopy />
        </button>
        <button type="button" className="log-btn log-btn--danger" onClick={onClear} disabled={clearing} aria-label={t('logViewer.actions.clear')} title={t('logViewer.actions.clear')}>
          <IconTrash />
        </button>
      </div>
    </div>
  </div>
);
