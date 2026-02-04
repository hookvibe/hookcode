import { FC, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Space, Typography, message } from 'antd';
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

/**
 * Live task log viewer (SSE/EventSource).
 *
 * Business context:
 * - Module: Frontend Chat / Tasks / Logs.
 * - Purpose: show real-time execution logs (dialog-style) for tasks and task groups.
 * - Note: ThoughtChain is replaced with a custom dialog layout. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
 *
 * Backend endpoint:
 * - `GET /api/tasks/:id/logs/stream` (SSE, supports `?token=` via `AllowQueryToken`).
 *
 * Pitfalls:
 * - Browser `EventSource` cannot set custom headers, so auth is passed via query `token`.
 * - The backend may disable logs globally; handle 404 / error states gracefully.
 *
 * Change record:
 * - 2026-01-11: Migrated from the legacy frontend to power the new chat-style views.
 */
// Reuse the shared SSE helper to keep EventSource URL building consistent across pages. kxthpiu4eqrmu0c6bboa

interface Props {
  taskId: string;
  tail?: number;
  canManage?: boolean;
  variant?: 'panel' | 'flat';
  controls?: {
    pause?: boolean;
    reconnect?: boolean;
  };
  // Allow task-aware empty-state copy so early logs show stage hints. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  emptyMessage?: string;
  emptyHint?: string;
  /**
   * Controlled paused state (useful when moving the Pause/Resume button to an external UI).
   * - When provided, the component no longer manages its own paused state.
   */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /**
   * External reconnect counter: when it changes, the SSE connection is re-established.
   */
  reconnectKey?: number;
  /**
   * External scroll-to-focus trigger: when `focusKey` changes, the component tries to scroll to the last log line that contains `focusText`.
   */
  focusText?: string;
  focusKey?: number;
}

// Delegate log timeline parsing to a shared reducer helper. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

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
  const [messageApi, messageContextHolder] = message.useMessage();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollTargetRef = useRef<HTMLElement | Window | null>(null); // Cache the nearest scroll container so log updates do not scroll-jump between multiple viewer instances. docs/en/developer/plans/xyaw6rrnebdb2uyuuv4a/task_plan.md xyaw6rrnebdb2uyuuv4a
  const pausedRef = useRef(false);
  const focusedKeyRef = useRef<number | null>(null);
  const autoScrollRef = useRef(true); // Keep the latest auto-scroll state for scheduled scroll updates. docs/en/developer/plans/xyaw6rrnebdb2uyuuv4a/task_plan.md xyaw6rrnebdb2uyuuv4a

  const showPauseButton = controls?.pause !== false;
  const showReconnectButton = controls?.reconnect !== false;

  const [logs, setLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<ViewerMode>('timeline'); // Prefer structured JSONL rendering (fallback to raw logs). yjlphd6rbkrq521ny796
  const [connecting, setConnecting] = useState(true);
  const [pausedInternal, setPausedInternal] = useState(false);
  const paused = pausedProp ?? pausedInternal;
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true); // Default to showing reasoning in dialog-style logs for task execution clarity. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
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
  const buildLineId = useCallback((idx: number) => `task-log-${taskId}-${idx}`, [taskId]); // Keep stable ids for raw log mode. yjlphd6rbkrq521ny796

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lines);
      messageApi.success(t('logViewer.copySuccess'));
    } catch {
      messageApi.error(t('logViewer.copyFailed'));
    }
  }, [lines, messageApi, t]);

  const clear = useCallback(async () => {
    if (!taskId || clearing) return;
    if (!canManage) {
      messageApi.warning(t('logViewer.clearNotAllowed'));
      return;
    }
    setClearing(true);
    try {
      await clearTaskLogs(taskId);
      setLogs([]);
      dispatchTimeline({ type: 'clear' });
      setSession((v) => v + 1);
      messageApi.success(t('logViewer.clearSuccess'));
    } catch {
      messageApi.error(t('logViewer.clearFailed'));
    } finally {
      setClearing(false);
    }
  }, [canManage, clearing, messageApi, t, taskId]);

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
      // Track "at bottom" state in a ref so scroll listeners don't trigger re-renders for every scroll event. docs/en/developer/plans/xyaw6rrnebdb2uyuuv4a/task_plan.md xyaw6rrnebdb2uyuuv4a
      autoScrollRef.current = isAtBottom();
    };
    const opts: AddEventListenerOptions = { passive: true };

    // Avoid nested scroll regions: track auto-scroll against the nearest scroll container. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
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
      // Keep the outer scroll container pinned to the bottom for streaming logs to avoid "bouncing" between multiple TaskLogViewer instances. docs/en/developer/plans/xyaw6rrnebdb2uyuuv4a/task_plan.md xyaw6rrnebdb2uyuuv4a
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

      // Fallback: if the scroll target cannot be resolved yet, scroll the log end marker into view. docs/en/developer/plans/xyaw6rrnebdb2uyuuv4a/task_plan.md xyaw6rrnebdb2uyuuv4a
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
    // Focus helpers remain raw-log only; the structured timeline does not have per-line anchors. yjlphd6rbkrq521ny796
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
          const sliced = next.slice(-MAX_LOG_LINES); // Enforce shared log buffer cap after extracting constants. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
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
    // Render the flat log view via a dedicated component to keep this module smaller. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
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
        messageContextHolder={messageContextHolder}
      />
    );
  }

  return (
    <div className="log-viewer" ref={rootRef}>
      {messageContextHolder}
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
        <Alert type="warning" showIcon message={error} style={{ marginBottom: 8 }} />
      ) : null}

      {/* Remove the inner fixed-height scroller; the outer page/container should own scrolling. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5 */}
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
              <Typography.Text type="secondary">{resolvedEmptyMessage}</Typography.Text>
              {emptyHint ? <Typography.Text type="secondary">{emptyHint}</Typography.Text> : null}
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
