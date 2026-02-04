import type { TFunction } from '../../i18n';
import type { ViewerMode } from './timeline';

export type TaskLogViewerHeaderProps = {
  t: TFunction;
  connecting: boolean;
  error: string | null;
  logsCount: number;
  showPauseButton: boolean;
  showReconnectButton: boolean;
  paused: boolean;
  onTogglePaused: () => void;
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

const IconPause = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
);
const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
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

export const TaskLogViewerHeader = ({
  t,
  connecting,
  error,
  logsCount,
  showPauseButton,
  showReconnectButton,
  paused,
  onTogglePaused,
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
    <div className="log-header__left">
      <span className="log-header__title">{t('execViewer.title')}</span>
      <span className={`log-header__status ${connecting ? 'is-connecting' : error ? 'is-error' : 'is-live'}`}>
        {connecting ? t('logViewer.state.connecting') : error ? t('logViewer.state.error') : t('logViewer.state.live')}
      </span>
      <span className="log-header__count">{t('logViewer.lines', { count: logsCount })}</span>
    </div>

    <div className="log-header__actions">
      {showPauseButton && (
        <button className="log-btn" onClick={onTogglePaused} title={paused ? t('logViewer.actions.resume') : t('logViewer.actions.pause')}>
          {paused ? <IconPlay /> : <IconPause />}
          <span>{paused ? t('logViewer.actions.resume') : t('logViewer.actions.pause')}</span>
        </button>
      )}
      {showReconnectButton && (
        <button className="log-btn" onClick={onReconnect} title={t('logViewer.actions.reconnect')}>
          <IconRefresh />
        </button>
      )}
      
      <div className="log-header__sep" />

      <button className="log-btn" onClick={onToggleMode} title={mode === 'timeline' ? t('execViewer.actions.showRaw') : t('execViewer.actions.showTimeline')}>
        {mode === 'timeline' ? <IconCode /> : <IconList />}
        <span>{mode === 'timeline' ? 'Raw' : 'Timeline'}</span>
      </button>

      {mode === 'timeline' && (
        <div className="log-toggles">
          <label className="log-toggle" title={t('execViewer.toggles.reasoning')}>
            <input type="checkbox" checked={showReasoning} onChange={(e) => onToggleShowReasoning(e.target.checked)} />
            <span>Reasoning</span>
          </label>
          <label className="log-toggle" title={t('execViewer.toggles.wrapDiff')}>
            <input type="checkbox" checked={wrapDiffLines} onChange={(e) => onToggleWrapDiffLines(e.target.checked)} />
            <span>Wrap</span>
          </label>
          <label className="log-toggle" title={t('execViewer.toggles.lineNumbers')}>
            <input type="checkbox" checked={showLineNumbers} onChange={(e) => onToggleShowLineNumbers(e.target.checked)} />
            <span>Lines</span>
          </label>
        </div>
      )}

      <div className="log-header__sep" />

      <button className="log-btn" onClick={onCopy} title={t('logViewer.actions.copy')}>
        <IconCopy />
      </button>
      <button className="log-btn log-btn--danger" onClick={onClear} disabled={clearing} title={t('logViewer.actions.clear')}>
        <IconTrash />
      </button>
    </div>
  </div>
);
