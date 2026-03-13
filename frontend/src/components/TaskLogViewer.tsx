import { FC, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { List } from 'react-window'; // Add virtual scrolling for long log lists. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306

// Bridge the current react-window usage to the installed type surface until the raw log viewer is fully refactored. docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313
const VirtualList = List as any;
import { clearTaskLogs, fetchTaskLogsPage } from '../api';
import { useT } from '../i18n';
import { createAuthedEventSource } from '../utils/sse';
import { ExecutionTimeline } from './execution/ExecutionTimeline';
import { createEmptyTimeline, type ExecutionTimelineState } from '../utils/executionLog';
import { TaskLogViewerFlat } from './taskLogViewer/TaskLogViewerFlat';
import { TaskLogViewerHeader } from './taskLogViewer/TaskLogViewerHeader';
import { MAX_LOG_LINES } from './taskLogViewer/constants';
import { timelineReducer, type ViewerMode } from './taskLogViewer/timeline';
import type { StreamInitPayload, StreamLogPayload } from './taskLogViewer/types';
import { LogViewerSkeleton } from './skeletons/LogViewerSkeleton'; // Show skeleton during initial log load. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306

interface Props {
  taskId: string;
  tail?: number;
  canManage?: boolean;
  variant?: 'panel' | 'flat';
  controls?: {
    reconnect?: boolean;
  };
  emptyMessage?: string;
  emptyHint?: string;
  reconnectKey?: number;
  focusText?: string;
  focusKey?: number;
  // Expose chain-loading hooks so TaskGroup scroll can drive log paging safely. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  loadEarlierSignal?: number;
  onHistoryExhaustedChange?: (exhausted: boolean) => void;
  onLoadingEarlierChange?: (loading: boolean) => void;
}

export const TaskLogViewer: FC<Props> = ({
  taskId,
  tail = 200,
  canManage = true,
  variant = 'panel',
  controls,
  emptyMessage,
  emptyHint,
  reconnectKey,
  focusText,
  focusKey,
  loadEarlierSignal,
  onHistoryExhaustedChange,
  onLoadingEarlierChange
}) => {
  const t = useT();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollTargetRef = useRef<HTMLElement | Window | null>(null);
  const focusedKeyRef = useRef<number | null>(null);
  const autoScrollRef = useRef(true);

  const showReconnectButton = controls?.reconnect !== false;

  const [logs, setLogs] = useState<string[]>([]);
  const [seqRange, setSeqRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [mode, setMode] = useState<ViewerMode>('timeline');
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [historyInitialized, setHistoryInitialized] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [wrapDiffLines, setWrapDiffLines] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [timeline, dispatchTimeline] = useReducer(timelineReducer, undefined, () => createEmptyTimeline());
  const logsRef = useRef<string[]>([]);
  const seqRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const nextBeforeRef = useRef<number | null>(null);
  const loadEarlierSignalRef = useRef<number | null>(null);
  const historyInitializedRef = useRef(false);
  const historyBootstrapInFlightRef = useRef(false);

  useEffect(() => {
    // Keep log paging refs in sync for SSE handlers. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    logsRef.current = logs;
    seqRangeRef.current = seqRange;
    nextBeforeRef.current = nextBefore;
  }, [logs, nextBefore, seqRange]);

  const lines = useMemo(() => logs.join('\n'), [logs]);
  const buildLineId = useCallback((idx: number) => `task-log-${taskId}-${idx}`, [taskId]);
  const pageSize = Math.min(Math.max(tail, 1), MAX_LOG_LINES);
  const historyExhausted = historyInitialized && !nextBefore;

  useEffect(() => {
    // Emit loading state to the task-group chain loader so scroll triggers do not overlap. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    onLoadingEarlierChange?.(loadingEarlier);
  }, [loadingEarlier, onLoadingEarlierChange]);

  useEffect(() => {
    // Report whether this task still has older log pages before unlocking previous tasks. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    onHistoryExhaustedChange?.(historyExhausted);
  }, [historyExhausted, onHistoryExhaustedChange]);

  useEffect(() => {
    // Keep history initialization state in a ref so stream error handlers can avoid stale closure reads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    historyInitializedRef.current = historyInitialized;
  }, [historyInitialized]);

  useEffect(() => {
    // Re-baseline external load signals per task id so chained scroll triggers start from current props. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    loadEarlierSignalRef.current = null;
  }, [taskId]);

  // Normalize log pages to keep in-memory window bounded during paging. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  const normalizeLogWindow = useCallback(
    (input: string[], startSeq: number, endSeq: number) => {
      if (!input.length) return { logs: [], startSeq: 0, endSeq: 0, dropped: 0 };
      if (input.length <= MAX_LOG_LINES) return { logs: input, startSeq, endSeq, dropped: 0 };
      const drop = input.length - MAX_LOG_LINES;
      return { logs: input.slice(drop), startSeq: startSeq + drop, endSeq, dropped: drop };
    },
    []
  );

  // Commit log paging state and keep timeline rendering consistent. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  const commitLogWindow = useCallback(
    (nextLogs: string[], startSeq: number, endSeq: number, nextBeforeValue: number | null, opts: { reset: boolean; appendLine?: string }) => {
      logsRef.current = nextLogs;
      seqRangeRef.current = { start: startSeq, end: endSeq };
      nextBeforeRef.current = nextBeforeValue;
      setLogs(nextLogs);
      setSeqRange({ start: startSeq, end: endSeq });
      setNextBefore(nextBeforeValue);
      if (opts.reset) {
        dispatchTimeline({ type: 'reset', lines: nextLogs });
      } else if (opts.appendLine) {
        dispatchTimeline({ type: 'append', line: opts.appendLine });
      }
    },
    []
  );

  const bootstrapHistoryFromHttp = useCallback(async () => {
    if (!taskId) return;
    if (historyBootstrapInFlightRef.current) return;
    historyBootstrapInFlightRef.current = true;
    try {
      // Fallback to HTTP log page bootstrap when SSE init never arrives to avoid chain-pagination deadlocks. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const page = await fetchTaskLogsPage(taskId, { limit: pageSize });
      const incoming = Array.isArray(page.logs) ? page.logs.filter((line) => typeof line === 'string') : [];
      const startSeq = Number.isFinite(page.startSeq) ? page.startSeq : incoming.length ? 1 : 0;
      const endSeq = Number.isFinite(page.endSeq) ? page.endSeq : startSeq ? startSeq + incoming.length - 1 : 0;
      const normalized = normalizeLogWindow(incoming, startSeq, endSeq);
      commitLogWindow(normalized.logs, normalized.startSeq, normalized.endSeq, page.nextBefore ?? null, {
        reset: true
      });
    } catch {
      // Ignore bootstrap fallback failures and let normal reconnect logic continue. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    } finally {
      historyInitializedRef.current = true;
      setHistoryInitialized(true);
    }
  }, [commitLogWindow, normalizeLogWindow, pageSize, taskId]);

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lines);
      // messageApi.success(t('logViewer.copySuccess'));
      console.log('Copied to clipboard');
    } catch {
      // messageApi.error(t('logViewer.copyFailed'));
      console.error('Failed to copy');
    }
  }, [lines, t]);

  const clear = useCallback(async () => {
    if (!taskId || clearing) return;
    if (!canManage) {
      console.warn(t('logViewer.clearNotAllowed'));
      return;
    }
    setClearing(true);
    try {
      await clearTaskLogs(taskId);
      // Reset paging state after clearing logs on the backend. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      commitLogWindow([], 0, 0, null, { reset: true });
      setSession((v) => v + 1);
      // messageApi.success(t('logViewer.clearSuccess'));
    } catch {
      // messageApi.error(t('logViewer.clearFailed'));
      console.error('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  }, [canManage, clearing, commitLogWindow, t, taskId]);

  const loadEarlier = useCallback(async () => {
    if (!taskId || loadingEarlier) return;
    const before = nextBeforeRef.current;
    if (!before) return;
    setLoadingEarlier(true);
    try {
      // Page earlier logs from the backend for long log streams. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
      const page = await fetchTaskLogsPage(taskId, { limit: pageSize, before });
      const incoming = Array.isArray(page.logs) ? page.logs.filter((line) => typeof line === 'string') : [];
      if (!incoming.length) {
        setNextBefore(page.nextBefore ?? null);
        return;
      }
      const currentLogs = logsRef.current;
      const startSeq = Number.isFinite(page.startSeq) ? page.startSeq : Math.max(1, before - incoming.length);
      const endSeq = Math.max(seqRangeRef.current.end, page.endSeq ?? 0);
      const merged = [...incoming, ...currentLogs];
      const normalized = normalizeLogWindow(merged, startSeq, endSeq);
      commitLogWindow(normalized.logs, normalized.startSeq, normalized.endSeq, page.nextBefore ?? null, { reset: true });
    } catch {
      setError(t('logViewer.error.autoReconnect'));
    } finally {
      setLoadingEarlier(false);
    }
  }, [commitLogWindow, loadingEarlier, normalizeLogWindow, pageSize, t, taskId]);

  useEffect(() => {
    // Allow parent timeline scroll handlers to request "load earlier" without direct refs. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
    if (loadEarlierSignal === undefined) return;
    if (loadEarlierSignalRef.current === null) {
      loadEarlierSignalRef.current = loadEarlierSignal;
      return;
    }
    if (loadEarlierSignal === loadEarlierSignalRef.current) return;
    loadEarlierSignalRef.current = loadEarlierSignal;
    void loadEarlier();
  }, [loadEarlier, loadEarlierSignal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = rootRef.current;
    if (!root) return;

    const isScrollableY = (node: HTMLElement): boolean => {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    };

    const findScrollTarget = (node: HTMLElement): HTMLElement | Window => {
      let current: HTMLElement | null = node;
      while (current?.parentElement) {
        const parent: HTMLElement = current.parentElement;
        if (isScrollableY(parent)) return parent;
        current = parent;
      }
      return window;
    };

    const target = findScrollTarget(root);
    scrollTargetRef.current = target;

    const isAtBottom = (): boolean => {
      if (target === window) {
        const doc = document.documentElement;
        return window.innerHeight + window.scrollY >= doc.scrollHeight - 24;
      }
      const el = target as HTMLElement;
      return el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };

    const onScroll = () => {
      autoScrollRef.current = isAtBottom();
    };
    const opts: AddEventListenerOptions = { passive: true };

    if (target === window) window.addEventListener('scroll', onScroll, opts);
    else target.addEventListener('scroll', onScroll, opts);

    onScroll();

    return () => {
      if (target === window) window.removeEventListener('scroll', onScroll);
      else target.removeEventListener('scroll', onScroll);
      scrollTargetRef.current = null;
    };
  }, [variant]);

  useEffect(() => {
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => window.setTimeout(cb, 0);

    schedule(() => {
      if (!autoScrollRef.current) return;
      const target = scrollTargetRef.current;
      if (target === window) {
        const doc = document.documentElement;
        const maxTop = Math.max(0, doc.scrollHeight - window.innerHeight);
        window.scrollTo({ top: maxTop, behavior: 'auto' });
        return;
      }
      if (target) {
        const el = target as HTMLElement;
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = maxTop;
        return;
      }

      const end = endRef.current as any;
      if (!end || typeof end.scrollIntoView !== 'function') return;
      try {
        end.scrollIntoView({ behavior: 'auto', block: 'end' });
      } catch {
        end.scrollIntoView();
      }
    });
  }, [logs.length]);

  useEffect(() => {
    if (mode !== 'raw') return;
    if (!focusText || focusKey === undefined || focusKey === null) return;
    if (focusedKeyRef.current === focusKey) return;

    let idx = -1;
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      if (logs[i]?.includes(focusText)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;

    focusedKeyRef.current = focusKey;
    autoScrollRef.current = false;

    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => window.setTimeout(cb, 0);

    schedule(() => {
      const el = document.getElementById(buildLineId(idx)) as any;
      if (!el || typeof el.scrollIntoView !== 'function') return;
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        el.scrollIntoView();
      }
    });
  }, [buildLineId, focusKey, focusText, logs, mode]);

  useEffect(() => {
    if (!taskId) return;

    let alive = true;
    let eventSource: EventSource | null = null;

    setLogs([]);
    setSeqRange({ start: 0, end: 0 });
    setNextBefore(null);
    setLoadingEarlier(false);
    setHistoryInitialized(false);
    historyInitializedRef.current = false;
    historyBootstrapInFlightRef.current = false;
    dispatchTimeline({ type: 'clear' });
    setConnecting(true);
    setError(null);

    const connect = () => {
      eventSource = createAuthedEventSource(`/tasks/${encodeURIComponent(taskId)}/logs/stream`, tail > 0 ? { tail: String(tail) } : undefined);

      eventSource.addEventListener('open', () => {
        if (!alive) return;
        setConnecting(false);
        setError(null);
      });

      eventSource.addEventListener('error', () => {
        if (!alive) return;
        setConnecting(false);
        setError(t('logViewer.error.autoReconnect'));
        if (!historyInitializedRef.current) {
          void bootstrapHistoryFromHttp();
        }
      });

      eventSource.addEventListener('init', (ev) => {
        if (!alive) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as StreamInitPayload;
          const next = Array.isArray(payload.logs) ? payload.logs.filter((v) => typeof v === 'string') : [];
          const startSeq = Number.isFinite(payload.startSeq) ? payload.startSeq : next.length ? 1 : 0;
          const endSeq = Number.isFinite(payload.endSeq) ? payload.endSeq : startSeq ? startSeq + next.length - 1 : 0;
          const normalized = normalizeLogWindow(next, startSeq, endSeq);
          const nextBefore = typeof payload.nextBefore === 'number' && Number.isFinite(payload.nextBefore) ? payload.nextBefore : null;
          commitLogWindow(normalized.logs, normalized.startSeq, normalized.endSeq, nextBefore, { reset: true });
          historyInitializedRef.current = true;
          setHistoryInitialized(true);
        } catch (err) {
          console.warn('[log] init parse failed', err);
        }
      });

      eventSource.addEventListener('log', (ev) => {
        if (!alive) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as StreamLogPayload;
          if (!payload?.line || !Number.isFinite(payload.seq)) return;
          const currentLogs = logsRef.current;
          const range = seqRangeRef.current;
          const startSeq = range.start || payload.seq;
          const endSeq = payload.seq;
          const merged = [...currentLogs, payload.line];
          const normalized = normalizeLogWindow(merged, startSeq, endSeq);
          const nextBeforeValue = normalized.dropped > 0 ? normalized.startSeq : nextBeforeRef.current;
          commitLogWindow(normalized.logs, normalized.startSeq, normalized.endSeq, nextBeforeValue ?? null, {
            reset: normalized.dropped > 0,
            appendLine: normalized.dropped > 0 ? undefined : payload.line
          });
        } catch (err) {
          console.warn('[log] parse failed', err);
        }
      });
    };

    connect();

    return () => {
      alive = false;
      eventSource?.close();
      eventSource = null;
    };
  }, [bootstrapHistoryFromHttp, commitLogWindow, normalizeLogWindow, reconnectKey, session, t, taskId, tail]);

  const resolvedEmptyMessage = emptyMessage ?? t('logViewer.empty');
  const canLoadEarlier = Boolean(nextBefore);

  // Show skeleton loader during initial connection to prevent layout shift. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
  if (connecting && !logs.length && !error) {
    return (
      <div className="log-viewer" ref={rootRef}>
        {variant === 'panel' && (
          <TaskLogViewerHeader
            t={t}
            connecting={connecting}
            error={null}
            logsCount={0}
            showLoadEarlier={false}
            loadingEarlier={false}
            onLoadEarlier={() => {}}
            showReconnectButton={showReconnectButton}
            onReconnect={() => setSession((v) => v + 1)}
            mode={mode}
            onToggleMode={() => setMode((v) => (v === 'timeline' ? 'raw' : 'timeline'))}
            showReasoning={showReasoning}
            onToggleShowReasoning={setShowReasoning}
            wrapDiffLines={wrapDiffLines}
            onToggleWrapDiffLines={setWrapDiffLines}
            showLineNumbers={showLineNumbers}
            onToggleShowLineNumbers={setShowLineNumbers}
            onCopy={() => void copyAll()}
            onClear={() => void clear()}
            clearing={clearing}
          />
        )}
        <div className="log-viewer__body">
          <LogViewerSkeleton lines={8} ariaLabel={t('logViewer.loading')} />
        </div>
      </div>
    );
  }

  if (variant === 'flat') {
    return (
      <TaskLogViewerFlat
        t={t}
        error={error}
        timeline={timeline}
        logs={logs}
        lines={lines}
        showReasoning={showReasoning}
        showLoadEarlier={canLoadEarlier} // Share pagination affordances with flat log view. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
        loadingEarlier={loadingEarlier}
        onLoadEarlier={() => void loadEarlier()}
        emptyMessage={resolvedEmptyMessage}
        emptyHint={emptyHint}
        rootRef={rootRef}
        endRef={endRef}
        messageContextHolder={null} // Removed message context
      />
    );
  }

  return (
    <div className="log-viewer" ref={rootRef}>
      <TaskLogViewerHeader
        t={t}
        connecting={connecting}
        error={error}
        logsCount={logs.length}
        showLoadEarlier={canLoadEarlier}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={() => void loadEarlier()}
        showReconnectButton={showReconnectButton}
        onReconnect={() => setSession((v) => v + 1)}
        mode={mode}
        onToggleMode={() => setMode((v) => (v === 'timeline' ? 'raw' : 'timeline'))}
        showReasoning={showReasoning}
        onToggleShowReasoning={setShowReasoning}
        wrapDiffLines={wrapDiffLines}
        onToggleWrapDiffLines={setWrapDiffLines}
        showLineNumbers={showLineNumbers}
        onToggleShowLineNumbers={setShowLineNumbers}
        onCopy={() => void copyAll()}
        onClear={() => void clear()}
        clearing={clearing}
      />

      {error ? (
        <div className="log-error">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
           <span>{error}</span>
           {/* Add retry button for failed log connections. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306 */}
           <button className="log-btn log-btn--small" onClick={() => setSession((v) => v + 1)} style={{ marginLeft: 'auto' }}>
             {t('logViewer.actions.reconnect')}
           </button>
        </div>
      ) : null}

      <div className="log-viewer__body">
        {mode === 'raw' ? (
          logs.length ? (
            // Use virtual scrolling for long log lists to prevent render lag. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
            logs.length > 100 ? (
              <VirtualList
                height={600}
                rowCount={logs.length}
                rowHeight={20}
                rowComponent={({ index, style }: { index: number; style: React.CSSProperties }) => (
                  <div style={style} id={buildLineId(index)} className="log-viewer__virtual-line">
                    {logs[index]}
                  </div>
                )}
                rowProps={{}}
              />
            ) : (
              <pre className="log-viewer__pre">
                {logs.map((line, idx) => (
                  <div key={idx} id={buildLineId(idx)}>
                    {line}
                  </div>
                ))}
              </pre>
            )
          ) : (
            <div className="log-viewer__empty">
              <span className="text-secondary">{resolvedEmptyMessage}</span>
              {emptyHint ? <span className="text-secondary">{emptyHint}</span> : null}
            </div>
          )
        ) : (
          <ExecutionTimeline
            items={timeline.items}
            showReasoning={showReasoning}
            wrapDiffLines={wrapDiffLines}
            showLineNumbers={showLineNumbers}
            emptyMessage={resolvedEmptyMessage}
            emptyHint={emptyHint}
          />
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};
