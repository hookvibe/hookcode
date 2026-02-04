import { FC, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { clearTaskLogs } from '../api';
import { useT } from '../i18n';
import { createAuthedEventSource } from '../utils/sse';
import { ExecutionTimeline } from './execution/ExecutionTimeline';
import { createEmptyTimeline, type ExecutionTimelineState } from '../utils/executionLog';
import { TaskLogViewerFlat } from './taskLogViewer/TaskLogViewerFlat';
import { TaskLogViewerHeader } from './taskLogViewer/TaskLogViewerHeader';
import { MAX_LOG_LINES } from './taskLogViewer/constants';
import { timelineReducer, type ViewerMode } from './taskLogViewer/timeline';
import type { StreamInitPayload, StreamLogPayload } from './taskLogViewer/types';

interface Props {
  taskId: string;
  tail?: number;
  canManage?: boolean;
  variant?: 'panel' | 'flat';
  controls?: {
    pause?: boolean;
    reconnect?: boolean;
  };
  emptyMessage?: string;
  emptyHint?: string;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  reconnectKey?: number;
  focusText?: string;
  focusKey?: number;
}

export const TaskLogViewer: FC<Props> = ({
  taskId,
  tail = 200,
  canManage = true,
  variant = 'panel',
  controls,
  emptyMessage,
  emptyHint,
  paused: pausedProp,
  onPausedChange,
  reconnectKey,
  focusText,
  focusKey
}) => {
  const t = useT();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollTargetRef = useRef<HTMLElement | Window | null>(null);
  const pausedRef = useRef(false);
  const focusedKeyRef = useRef<number | null>(null);
  const autoScrollRef = useRef(true);

  const showPauseButton = controls?.pause !== false;
  const showReconnectButton = controls?.reconnect !== false;

  const [logs, setLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<ViewerMode>('timeline');
  const [connecting, setConnecting] = useState(true);
  const [pausedInternal, setPausedInternal] = useState(false);
  const paused = pausedProp ?? pausedInternal;
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [wrapDiffLines, setWrapDiffLines] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [timeline, dispatchTimeline] = useReducer(timelineReducer, undefined, () => createEmptyTimeline());

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const setPaused = useCallback(
    (next: boolean) => {
      if (pausedProp !== undefined) {
        onPausedChange?.(next);
        return;
      }
      setPausedInternal(next);
    },
    [onPausedChange, pausedProp]
  );

  const lines = useMemo(() => logs.join('\n'), [logs]);
  const buildLineId = useCallback((idx: number) => `task-log-${taskId}-${idx}`, [taskId]);

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
      setLogs([]);
      dispatchTimeline({ type: 'clear' });
      setSession((v) => v + 1);
      // messageApi.success(t('logViewer.clearSuccess'));
    } catch {
      // messageApi.error(t('logViewer.clearFailed'));
      console.error('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  }, [canManage, clearing, t, taskId]);

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
        const parent = current.parentElement;
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
      });

      eventSource.addEventListener('init', (ev) => {
        if (!alive) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as StreamInitPayload;
          const next = Array.isArray(payload.logs) ? payload.logs.filter((v) => typeof v === 'string') : [];
          const sliced = next.slice(-MAX_LOG_LINES);
          setLogs(sliced);
          dispatchTimeline({ type: 'reset', lines: sliced });
        } catch (err) {
          console.warn('[log] init parse failed', err);
        }
      });

      eventSource.addEventListener('log', (ev) => {
        if (!alive) return;
        if (pausedRef.current) return;
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as StreamLogPayload;
          if (!payload?.line) return;
          setLogs((prev) => [...prev, payload.line].slice(-MAX_LOG_LINES));
          dispatchTimeline({ type: 'append', line: payload.line });
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
  }, [taskId, tail, session, reconnectKey, t]);

  const resolvedEmptyMessage = emptyMessage ?? t('logViewer.empty');

  if (variant === 'flat') {
    return (
      <TaskLogViewerFlat
        t={t}
        error={error}
        timeline={timeline}
        logs={logs}
        lines={lines}
        showReasoning={showReasoning}
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
        showPauseButton={showPauseButton}
        showReconnectButton={showReconnectButton}
        paused={paused}
        onTogglePaused={() => setPaused(!paused)}
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
        </div>
      ) : null}

      <div className="log-viewer__body">
        {mode === 'raw' ? (
          logs.length ? (
            <pre className="log-viewer__pre">
              {logs.map((line, idx) => (
                <div key={idx} id={buildLineId(idx)}>
                  {line}
                </div>
              ))}
            </pre>
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
