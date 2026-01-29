import { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App, Button, Input, Modal, Popover, Select, Space, Tooltip, Typography } from 'antd';
import {
  ClockCircleOutlined,
  CopyOutlined,
  ExportOutlined,
  FileTextOutlined,
  SendOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import type {
  PreviewInstanceSummary,
  PreviewLogEntry,
  PreviewStatusResponse,
  RepoRobot,
  Repository,
  Task,
  TaskGroup,
  TimeWindow
} from '../api';
import {
  API_BASE_URL,
  executeChat,
  fetchTask,
  fetchTaskGroup,
  fetchTaskGroupPreviewStatus,
  fetchTaskGroupTasks,
  listRepoRobots,
  listRepos,
  startTaskGroupPreview,
  stopTaskGroupPreview
} from '../api';
import { getToken } from '../auth';
import { useLocale, useT } from '../i18n';
import { buildTaskGroupHash, buildTaskGroupsHash, buildTaskHash } from '../router';
import { TaskConversationItem } from '../components/chat/TaskConversationItem';
import { PageNav } from '../components/nav/PageNav';
import { isTerminalStatus } from '../utils/task';
import { ChatTimelineSkeleton } from '../components/skeletons/ChatTimelineSkeleton';
import { TimeWindowPicker } from '../components/TimeWindowPicker';
import { formatTimeWindowLabel } from '../utils/timeWindow';
import { formatRobotLabelWithProvider } from '../utils/robot';

/**
 * TaskGroupChatPage:
 * - Business context: unified "chat-style" view for task groups.
 * - Behaviors:
 *   - When `taskGroupId` is provided: show the group's tasks in a chat-like timeline.
 *   - When `taskGroupId` is absent: allow users to start a new manual chat group via `/chat`.
 *
 * Key requirements (migration step 1):
 * - Repo must be selected before creating a new task group.
 * - Robot must be selected before sending a task.
 * - Thought chain == real-time task logs (handled by `TaskConversationItem`).
 *
 * Change record:
 * - 2026-01-11: Added for `frontend-chat` Home page migration (replace `#/chat` with `#/`).
 * - 2026-01-11: Improve i18n coverage and mobile-friendly sender controls.
 */

export interface TaskGroupChatPageProps {
  taskGroupId?: string;
  userPanel?: ReactNode;
  taskLogsEnabled?: boolean | null;
}

export const TaskGroupChatPage: FC<TaskGroupChatPageProps> = ({ taskGroupId, userPanel, taskLogsEnabled }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const effectiveTaskLogsEnabled = taskLogsEnabled === undefined ? true : taskLogsEnabled; // Reuse `/auth/me` feature toggles to avoid repeated SSE 404 retries when logs are disabled. 0nazpc53wnvljv5yh7c6

  const [reposLoading, setReposLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoId, setRepoId] = useState('');

  const [robotsLoading, setRobotsLoading] = useState(false);
  const [robots, setRobots] = useState<RepoRobot[]>([]);
  const [robotId, setRobotId] = useState('');

  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDetailsById, setTaskDetailsById] = useState<Record<string, Task | null>>({});
  // Track the latest sent task so it can animate into its final chat position. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  const [recentTaskId, setRecentTaskId] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Track optional chat-level time windows for manual scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const [chatTimeWindow, setChatTimeWindow] = useState<TimeWindow | null>(null);
  // Compute a concise label for the chat time window icon badge. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const chatTimeWindowLabel = useMemo(() => formatTimeWindowLabel(chatTimeWindow), [chatTimeWindow]);

  // Track TaskGroup preview status to render the dev server panel. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const [previewState, setPreviewState] = useState<PreviewStatusResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewActionLoading, setPreviewActionLoading] = useState(false);
  // Keep preview tabs and logs state aligned with multi-instance previews. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const [activePreviewName, setActivePreviewName] = useState<string | null>(null);
  const [previewLogsOpen, setPreviewLogsOpen] = useState(false);
  const [previewLogsLoading, setPreviewLogsLoading] = useState(false);
  const [previewLogs, setPreviewLogs] = useState<PreviewLogEntry[]>([]);
  const previewLogStreamRef = useRef<EventSource | null>(null);
  // Maintain draggable preview panel sizing state for Phase 3 layout updates. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const [previewPanelWidth, setPreviewPanelWidth] = useState<number | null>(null);
  const [previewDragActive, setPreviewDragActive] = useState(false);
  const [previewLayoutWidth, setPreviewLayoutWidth] = useState(0);
  const previewDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const chatAutoScrollEnabledRef = useRef(true);
  const chatDidInitScrollRef = useRef(false);
  const chatPrependScrollRestoreRef = useRef<null | { scrollTop: number; scrollHeight: number }>(null);
  const chatPrependInFlightRef = useRef(false);
  const groupRef = useRef<TaskGroup | null>(null);
  // Preserve the newly created group id so route-driven refresh stays non-blocking. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  const optimisticGroupIdRef = useRef<string | null>(null);
  const groupRequestSeqRef = useRef(0);
  const groupRequestInFlightRef = useRef(false);
  // Throttle polling error toasts so network flaps don't spam the UI. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126
  const lastGroupRefreshNoticeAtRef = useRef(0);
  const GROUP_REFRESH_NOTICE_COOLDOWN_MS = 15000;
  const GROUP_REFRESH_NOTICE_KEY = 'task-group-refresh-warning';
  // Cap preview log buffering on the frontend to keep the modal responsive. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const PREVIEW_LOG_TAIL = 200;
  const PREVIEW_LOG_MAX = 500;
  // Configure preview panel resize constraints and persistence. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const PREVIEW_PANEL_MIN_WIDTH = 320;
  const PREVIEW_PANEL_MIN_CHAT_WIDTH = 420;
  const PREVIEW_PANEL_DEFAULT_RATIO = 0.38;
  const PREVIEW_PANEL_STORAGE_KEY = 'hc-preview-panel-width';

  const repoLocked = Boolean(taskGroupId);

  const enabledRepos = useMemo(() => repos.filter((r) => r.enabled), [repos]);
  const enabledRobots = useMemo(() => robots.filter((r) => Boolean(r?.enabled)), [robots]);

  const repoOptions = useMemo(
    () =>
      enabledRepos.map((r) => ({
        value: r.id,
        label: r.name ? `${r.name} (${r.provider === 'github' ? 'GitHub' : 'GitLab'})` : r.id
      })),
    [enabledRepos]
  );

  const robotOptions = useMemo(
    () =>
      enabledRobots.map((r) => ({
        value: r.id,
        // Add bound AI provider to robot labels in the picker. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
        label: formatRobotLabelWithProvider(r.name || r.id, r.modelProvider)
      })),
    [enabledRobots]
  );

  const orderedTasks = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return list;
  }, [tasks]);

  const TASK_PAGE_SIZE = 3;
  const [taskHiddenCount, setTaskHiddenCount] = useState(0);
  const [taskPagingPinnedToLatest, setTaskPagingPinnedToLatest] = useState(true);

  const pinnedHiddenCount = Math.max(0, orderedTasks.length - TASK_PAGE_SIZE);
  const effectiveHiddenCount = Math.max(
    0,
    Math.min(taskPagingPinnedToLatest ? pinnedHiddenCount : taskHiddenCount, orderedTasks.length)
  );
  const visibleTasks = useMemo(() => orderedTasks.slice(effectiveHiddenCount), [effectiveHiddenCount, orderedTasks]);

  const previewInstances = previewState?.instances ?? [];
  const previewAvailable = previewState?.available ?? false;
  // Compute the maximum preview width based on the current layout size. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewPanelMaxWidth = useMemo(() => {
    if (!previewLayoutWidth) return 0;
    return Math.max(PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
  }, [PREVIEW_PANEL_MIN_CHAT_WIDTH, PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth]);

  useLayoutEffect(() => {
    // Track layout width so the preview resize bounds adapt on window changes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!taskGroupId) return;
    const layout = layoutRef.current;
    if (!layout) return;
    const updateLayoutWidth = () => {
      setPreviewLayoutWidth(layout.getBoundingClientRect().width);
    };
    updateLayoutWidth();
    window.addEventListener('resize', updateLayoutWidth);
    return () => window.removeEventListener('resize', updateLayoutWidth);
  }, [taskGroupId]);

  useLayoutEffect(() => {
    // Seed preview panel width from storage or defaults once layout metrics are available. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!taskGroupId || !previewLayoutWidth || previewPanelWidth !== null) return;
    let storedWidth: number | null = null;
    try {
      const raw = window.localStorage.getItem(PREVIEW_PANEL_STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) storedWidth = parsed;
    } catch {
      storedWidth = null;
    }
    const fallback = Math.round(previewLayoutWidth * PREVIEW_PANEL_DEFAULT_RATIO);
    const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
    const nextWidth = Math.min(Math.max(storedWidth ?? fallback, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
    setPreviewPanelWidth(nextWidth);
  }, [
    PREVIEW_PANEL_DEFAULT_RATIO,
    PREVIEW_PANEL_MIN_CHAT_WIDTH,
    PREVIEW_PANEL_MIN_WIDTH,
    PREVIEW_PANEL_STORAGE_KEY,
    previewLayoutWidth,
    previewPanelWidth,
    taskGroupId
  ]);

  useEffect(() => {
    // Clamp preview panel width when the layout shrinks. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!previewLayoutWidth || previewPanelWidth === null) return;
    const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
    const clamped = Math.min(Math.max(previewPanelWidth, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
    if (clamped !== previewPanelWidth) setPreviewPanelWidth(clamped);
  }, [PREVIEW_PANEL_MIN_CHAT_WIDTH, PREVIEW_PANEL_MIN_WIDTH, previewLayoutWidth, previewPanelWidth]);

  useEffect(() => {
    // Persist preview panel width so it survives refreshes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (previewPanelWidth === null) return;
    try {
      window.localStorage.setItem(PREVIEW_PANEL_STORAGE_KEY, String(previewPanelWidth));
    } catch {
      // ignore
    }
  }, [PREVIEW_PANEL_STORAGE_KEY, previewPanelWidth]);

  const handlePreviewDividerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Start dragging only on wide layouts where the preview sits side-by-side. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
      if (!layoutRef.current || window.matchMedia('(max-width: 1024px)').matches) return;
      const layoutWidth = layoutRef.current.getBoundingClientRect().width;
      if (!layoutWidth) return;
      const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, layoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
      const fallbackWidth = Math.round(layoutWidth * PREVIEW_PANEL_DEFAULT_RATIO);
      const startWidth = Math.min(
        Math.max(previewPanelWidth ?? fallbackWidth, PREVIEW_PANEL_MIN_WIDTH),
        maxWidth
      );
      previewDragRef.current = { startX: event.clientX, startWidth };
      setPreviewDragActive(true);
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [PREVIEW_PANEL_DEFAULT_RATIO, PREVIEW_PANEL_MIN_CHAT_WIDTH, PREVIEW_PANEL_MIN_WIDTH, previewPanelWidth]
  );

  useEffect(() => {
    // Track pointer movement while resizing the preview panel. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!previewDragActive) return;
    const handleMove = (event: PointerEvent) => {
      const drag = previewDragRef.current;
      const layout = layoutRef.current;
      if (!drag || !layout) return;
      const layoutWidth = layout.getBoundingClientRect().width;
      if (!layoutWidth) return;
      const maxWidth = Math.max(PREVIEW_PANEL_MIN_WIDTH, layoutWidth - PREVIEW_PANEL_MIN_CHAT_WIDTH);
      const deltaX = event.clientX - drag.startX;
      const nextWidth = Math.min(Math.max(drag.startWidth - deltaX, PREVIEW_PANEL_MIN_WIDTH), maxWidth);
      setPreviewPanelWidth(nextWidth);
    };

    const handleUp = () => {
      setPreviewDragActive(false);
      previewDragRef.current = null;
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [PREVIEW_PANEL_MIN_CHAT_WIDTH, PREVIEW_PANEL_MIN_WIDTH, previewDragActive]);

  useEffect(() => {
    // Keep the active preview tab in sync with available instances. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (previewInstances.length === 0) {
      setActivePreviewName(null);
      return;
    }
    if (!activePreviewName || !previewInstances.some((instance) => instance.name === activePreviewName)) {
      setActivePreviewName(previewInstances[0].name);
    }
  }, [activePreviewName, previewInstances]);

  const activePreviewInstance = useMemo<PreviewInstanceSummary | null>(
    () => previewInstances.find((instance) => instance.name === activePreviewName) ?? previewInstances[0] ?? null,
    [activePreviewName, previewInstances]
  );

  // Aggregate preview statuses so the toggle reflects multi-instance state. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewAggregateStatus = useMemo(() => {
    if (!previewState || !previewAvailable) return 'stopped';
    const statuses = previewInstances.map((instance) => instance.status);
    if (statuses.includes('starting')) return 'starting';
    if (statuses.includes('running')) return 'running';
    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('timeout')) return 'timeout';
    return 'stopped';
  }, [previewAvailable, previewInstances, previewState]);

  // Keep the preview panel visible when previews are active or starting. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewPanelOpen = previewAvailable && (previewAggregateStatus !== 'stopped' || previewActionLoading);

  useEffect(() => {
    // Stop drag interactions when the preview panel is hidden. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (previewPanelOpen) return;
    setPreviewDragActive(false);
    previewDragRef.current = null;
  }, [previewPanelOpen]);

  const previewAggregateStatusLabel = useMemo(() => {
    if (!previewState) return t('preview.status.idle');
    if (!previewAvailable) return t('preview.status.unavailable');
    switch (previewAggregateStatus) {
      case 'starting':
        return t('preview.status.starting');
      case 'running':
        return t('preview.status.running');
      case 'failed':
        return t('preview.status.failed');
      case 'timeout':
        return t('preview.status.timeout');
      default:
        return t('preview.status.stopped');
    }
  }, [previewAggregateStatus, previewAvailable, previewState, t]);

  const activePreviewStatus = activePreviewInstance?.status ?? 'stopped';
  const activePreviewStatusLabel = useMemo(() => {
    if (!previewState) return t('preview.status.idle');
    if (!previewAvailable) return t('preview.status.unavailable');
    switch (activePreviewStatus) {
      case 'starting':
        return t('preview.status.starting');
      case 'running':
        return t('preview.status.running');
      case 'failed':
        return t('preview.status.failed');
      case 'timeout':
        return t('preview.status.timeout');
      default:
        return t('preview.status.stopped');
    }
  }, [activePreviewStatus, previewAvailable, previewState, t]);

  const previewPlaceholderText = useMemo(() => {
    if (!previewAvailable) return t('preview.empty.unavailable');
    if (activePreviewStatus === 'starting') return t('preview.empty.starting');
    if (activePreviewStatus === 'running') return t('preview.empty.running');
    if (activePreviewStatus === 'failed') return t('preview.empty.failed');
    if (activePreviewStatus === 'timeout') return t('preview.empty.timeout');
    return t('preview.empty.stopped');
  }, [activePreviewStatus, previewAvailable, t]);

  // Provide diagnostic excerpts for failed/timeout preview states. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewDiagnostics = activePreviewInstance?.diagnostics;
  // Limit diagnostics log excerpts to keep the placeholder compact. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewDiagnosticsLogs = useMemo(
    () => previewDiagnostics?.logs?.slice(-6) ?? [],
    [previewDiagnostics?.logs]
  );
  // Apply persisted preview panel width when side-by-side layout is active. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewPanelStyle = useMemo(
    () => (previewPanelWidth === null ? undefined : { width: previewPanelWidth }),
    [previewPanelWidth]
  );

  const previewIframeSrc = useMemo(() => {
    if (!activePreviewInstance?.path || (activePreviewStatus !== 'running' && activePreviewStatus !== 'starting')) {
      return '';
    }
    const base = API_BASE_URL.replace(/\/$/, '');
    const token = getToken();
    const url = `${base}${activePreviewInstance.path}`;
    if (!token) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }, [activePreviewInstance?.path, activePreviewStatus]);

  // Format preview log timestamps for the log viewer. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const formatPreviewLogTime = useCallback(
    (value: string) => {
      try {
        return new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(value));
      } catch {
        return value;
      }
    },
    [locale]
  );

  useEffect(() => {
    // Reset TaskGroup paging when switching groups so users always start from the latest page. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    chatDidInitScrollRef.current = false;
    chatAutoScrollEnabledRef.current = true;
    chatPrependInFlightRef.current = false;
    chatPrependScrollRestoreRef.current = null;
    setTaskPagingPinnedToLatest(true);
    setTaskHiddenCount(0);
  }, [taskGroupId]);

  const groupTitle = useMemo(() => {
    if (!group) return '';
    const title = String(group.title ?? '').trim();
    return title || group.id;
  }, [group]);

  const groupUpdatedAtText = useMemo(() => {
    if (!group?.updatedAt) return '';
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(group.updatedAt)
      );
    } catch {
      return group.updatedAt;
    }
  }, [group?.updatedAt, locale]);

  useEffect(() => {
    // UX: keep a ref to the latest group so refresh helpers can stay dependency-free (avoid re-starting timers on every render).
    groupRef.current = group;
  }, [group]);

  const refreshRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const data = await listRepos();
      setRepos(data);
      if (!repoId) {
        const firstEnabled = data.find((r) => r.enabled);
        if (firstEnabled) setRepoId(firstEnabled.id);
      }
    } catch (err) {
      console.error(err);
      message.error(t('toast.chat.reposLoadFailed'));
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, [message, repoId, t]);

  const refreshRobots = useCallback(
    async (targetRepoId: string, preferredRobotId?: string) => {
      if (!targetRepoId) {
        setRobots([]);
        setRobotId('');
        return;
      }
      setRobotsLoading(true);
      try {
        const data = await listRepoRobots(targetRepoId);
        const list = Array.isArray(data) ? data : [];
        setRobots(list);

        // Select a reasonable default robot for the sender:
        // - Prefer the task group robotId (if any), then the repo default, then the first enabled robot.
        const enabled = list.filter((r) => Boolean(r?.enabled));
        const next =
          (preferredRobotId && enabled.find((r) => r.id === preferredRobotId)) ||
          enabled.find((r) => r.isDefault) ||
          enabled[0] ||
          null;

        setRobotId((prev) => {
          const stillValid = prev && enabled.some((r) => r.id === prev);
          return stillValid ? prev : next?.id ?? '';
        });
      } catch (err) {
        console.error(err);
        message.error(t('toast.chat.robotsLoadFailed'));
        setRobots([]);
        setRobotId('');
      } finally {
        setRobotsLoading(false);
      }
    },
    [message, t]
  );

  const refreshGroupDetail = useCallback(
    async (targetGroupId: string, options?: { mode?: 'blocking' | 'refreshing' }) => {
      // Change record (2026-01-12):
      // - Fix "stuck loading" by versioning in-flight requests and clearing loading flags on fast navigation.
      // - Avoid flashing the whole chat timeline during polling by keeping the `blocking` loading state scoped to route switches only.
      if (!targetGroupId) {
        // Navigation note: ensure any pending request becomes stale so a late response cannot overwrite the "new group" UI.
        groupRequestSeqRef.current += 1;
        groupRequestInFlightRef.current = false;
        groupRef.current = null;
        setGroup(null);
        setTasks([]);
        setTaskDetailsById({});
        return;
      }

      const mode = options?.mode ?? 'blocking';
      // Loading UI is derived from group-id readiness so stale flags cannot lock the skeleton. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
      if (mode === 'refreshing' && groupRequestInFlightRef.current) return;

      const requestSeq = (groupRequestSeqRef.current += 1);
      groupRequestInFlightRef.current = true;

      try {
        const [g, taskList] = await Promise.all([fetchTaskGroup(targetGroupId), fetchTaskGroupTasks(targetGroupId, { limit: 50 })]);
        if (groupRequestSeqRef.current !== requestSeq) return;
        setGroup(g);
        // UX: keep `groupRef` in sync immediately so refresh-mode decisions are reliable even before effects run.
        groupRef.current = g;
        setTasks(taskList);
        if (g?.repoId) setRepoId(g.repoId);
      } catch (err) {
        if (groupRequestSeqRef.current !== requestSeq) return;
        console.error(err);
        const error = err as any;
        const status = error?.response?.status as number | undefined;
        const isNetworkFailure = !error?.response;
        // Preserve the last snapshot on transient refresh failures to prevent UI resets. docs/en/developer/plans/netflapui20260126/task_plan.md netflapui20260126
        const shouldPreserveSnapshot = Boolean(groupRef.current) && (isNetworkFailure || (status !== undefined && status >= 500));
        const shouldThrottleNotice = mode === 'refreshing';
        if (shouldThrottleNotice) {
          const now = Date.now();
          if (now - lastGroupRefreshNoticeAtRef.current >= GROUP_REFRESH_NOTICE_COOLDOWN_MS) {
            lastGroupRefreshNoticeAtRef.current = now;
            message.warning({ content: t('toast.chat.groupLoadFailed'), key: GROUP_REFRESH_NOTICE_KEY, duration: 3 });
          }
        } else {
          message.error(t('toast.chat.groupLoadFailed'));
        }
        if (!shouldPreserveSnapshot) {
          groupRef.current = null;
          setGroup(null);
          setTasks([]);
          setTaskDetailsById({});
        }
      } finally {
        if (groupRequestSeqRef.current !== requestSeq) return;
        groupRequestInFlightRef.current = false;
      }
    },
    [message, t]
  );

  // Poll preview status so the UI can drive iframe visibility and toggle state. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const refreshPreviewStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!taskGroupId) {
        setPreviewState(null);
        return;
      }
      const silent = options?.silent ?? false;
      if (!silent) setPreviewLoading(true);
      try {
        const data = await fetchTaskGroupPreviewStatus(taskGroupId);
        setPreviewState(data);
      } catch (err: any) {
        const status = err?.response?.status as number | undefined;
        const code = err?.response?.data?.code as PreviewStatusResponse['reason'] | undefined;
        if (status === 404 || status === 409) {
          setPreviewState({ available: false, instances: [], reason: code ?? 'config_missing' });
        } else {
          console.error(err);
          if (!silent) message.error(t('preview.statusFailed'));
          setPreviewState({ available: false, instances: [] });
        }
      } finally {
        if (!silent) setPreviewLoading(false);
      }
    },
    [message, t, taskGroupId]
  );

  // Start/stop previews from the TaskGroup page toggle button. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const handlePreviewToggle = useCallback(async () => {
    if (!taskGroupId) return;
    setPreviewActionLoading(true);
    try {
      const isActive = previewAggregateStatus === 'running' || previewAggregateStatus === 'starting';
      if (isActive) {
        await stopTaskGroupPreview(taskGroupId);
      } else {
        await startTaskGroupPreview(taskGroupId);
      }
      await refreshPreviewStatus({ silent: true });
    } catch (err) {
      console.error(err);
      message.error(t('preview.toggleFailed'));
    } finally {
      setPreviewActionLoading(false);
    }
  }, [message, previewAggregateStatus, refreshPreviewStatus, taskGroupId, t]);

  // Provide share/open controls for preview URLs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const handleOpenPreviewWindow = useCallback(() => {
    if (!previewIframeSrc) return;
    window.open(previewIframeSrc, '_blank', 'noopener,noreferrer');
  }, [previewIframeSrc]);

  const handleCopyPreviewLink = useCallback(async () => {
    if (!previewIframeSrc) return;
    try {
      await navigator.clipboard.writeText(previewIframeSrc);
      message.success(t('preview.copyLinkSuccess'));
    } catch (err) {
      console.error(err);
      message.error(t('preview.copyLinkFailed'));
    }
  }, [message, previewIframeSrc, t]);

  useEffect(() => {
    // Maintain a live SSE connection when the preview logs modal is open. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!previewLogsOpen) {
      previewLogStreamRef.current?.close();
      previewLogStreamRef.current = null;
      setPreviewLogs([]);
      setPreviewLogsLoading(false);
      return;
    }
    if (!taskGroupId || !activePreviewInstance?.name) return;

    const base = API_BASE_URL.replace(/\/$/, '');
    const token = getToken();
    const params = new URLSearchParams();
    params.set('tail', String(PREVIEW_LOG_TAIL));
    if (token) params.set('token', token);
    const url = `${base}/task-groups/${taskGroupId}/preview/${activePreviewInstance.name}/logs?${params.toString()}`;

    setPreviewLogsLoading(true);
    setPreviewLogs([]);
    const source = new EventSource(url);
    previewLogStreamRef.current = source;

    const handleInit = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const nextLogs = Array.isArray(payload.logs) ? (payload.logs as PreviewLogEntry[]) : [];
        setPreviewLogs(nextLogs.slice(-PREVIEW_LOG_MAX));
      } catch (err) {
        console.error(err);
      } finally {
        setPreviewLogsLoading(false);
      }
    };

    const handleLog = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}') as PreviewLogEntry;
        if (!payload?.message) return;
        setPreviewLogs((prev) => {
          const next = [...prev, payload];
          return next.length > PREVIEW_LOG_MAX ? next.slice(-PREVIEW_LOG_MAX) : next;
        });
      } catch (err) {
        console.error(err);
      }
    };

    source.addEventListener('init', handleInit);
    source.addEventListener('log', handleLog);
    source.onerror = () => {
      setPreviewLogsLoading(false);
    };

    return () => {
      source.removeEventListener('init', handleInit);
      source.removeEventListener('log', handleLog);
      source.close();
      previewLogStreamRef.current = null;
    };
  }, [activePreviewInstance?.name, previewLogsOpen, taskGroupId, PREVIEW_LOG_TAIL, PREVIEW_LOG_MAX]);

  useEffect(() => {
    void refreshRepos();
  }, [refreshRepos]);

  useEffect(() => {
    if (!repoId) return;
    void refreshRobots(repoId, group?.robotId ?? undefined);
  }, [group?.robotId, refreshRobots, repoId]);

  useEffect(() => {
    if (!taskGroupId) {
      void refreshGroupDetail('');
      return;
    }
    // Keep initial navigation to a freshly-created group non-blocking so the chat item stays visible. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
    const isOptimisticGroup = optimisticGroupIdRef.current === taskGroupId;
    const refreshPromise = refreshGroupDetail(taskGroupId, { mode: isOptimisticGroup ? 'refreshing' : 'blocking' });
    if (isOptimisticGroup) {
      void refreshPromise.finally(() => {
        if (optimisticGroupIdRef.current === taskGroupId) optimisticGroupIdRef.current = null;
      });
    } else {
      void refreshPromise;
    }

    // Poll for task status changes to update the chat view.
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollTimerRef.current = window.setInterval(() => refreshGroupDetail(taskGroupId, { mode: 'refreshing' }), 5000);
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [refreshGroupDetail, taskGroupId]);

  useEffect(() => {
    // Clear preview state on group changes so panel visibility does not leak between groups. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    setPreviewState(null);
    if (!taskGroupId) return;
    void refreshPreviewStatus({ silent: true });
  }, [refreshPreviewStatus, taskGroupId]);

  const previewNeedsPolling = previewState?.instances?.some((instance) => instance.status === 'starting') ?? false;

  useEffect(() => {
    if (!taskGroupId || !previewNeedsPolling) return;
    const timer = window.setInterval(() => refreshPreviewStatus({ silent: true }), 2000);
    return () => window.clearInterval(timer);
  }, [previewNeedsPolling, refreshPreviewStatus, taskGroupId]);

  useEffect(() => {
    // Fetch task details (including outputText) for completed tasks to render the final assistant output in chat.
    const candidates = tasks.filter((task) => isTerminalStatus(task.status) && !taskDetailsById[task.id]);
    if (!candidates.length) return;

    let canceled = false;
    Promise.all(
      candidates.map((task) =>
        fetchTask(task.id)
          .then((detail) => detail)
          .catch(() => null)
      )
    ).then((details) => {
      if (canceled) return;
      setTaskDetailsById((prev) => {
        const next = { ...prev };
        for (const d of details) {
          if (!d) continue;
          next[d.id] = d;
        }
        return next;
      });
    });

    return () => {
      canceled = true;
    };
  }, [taskDetailsById, tasks]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = String(text ?? '').trim();
      if (!repoId) {
        message.warning(t('chat.validation.repoRequired'));
        return;
      }
      if (!robotId) {
        message.warning(t('chat.validation.robotRequired'));
        return;
      }
      if (!trimmed) {
        message.warning(t('chat.validation.textRequired'));
        return;
      }
      if (sending) return;

      setSending(true);
      try {
        const res = await executeChat({
          repoId,
          robotId,
          text: trimmed,
          taskGroupId: taskGroupId || undefined,
          // Pass chat-level time windows when configured. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
          timeWindow: chatTimeWindow
        });
        message.success(t('toast.chat.executeSuccess'));
        setDraft('');

      const nextGroupId = res.taskGroup?.id ?? '';
      if (nextGroupId && !taskGroupId) {
        // Mark the new group as optimistic so we avoid a blocking skeleton during route transition. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
        optimisticGroupIdRef.current = nextGroupId;
        // Navigation note: when creating a new group, jump to the group route so sidebar selection stays in sync.
        window.location.hash = buildTaskGroupHash(nextGroupId);
      }
        setGroup(res.taskGroup ?? null);
        // UX: update the ref immediately so a follow-up refresh does not temporarily show a blocking loading state.
        groupRef.current = res.taskGroup ?? null;
        if (res.task?.id) {
          // Flag the most recent task so it animates into place instead of showing a skeleton. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
          setRecentTaskId(res.task.id);
          setTasks((prev) => [res.task, ...prev.filter((task) => task.id !== res.task.id)]);
        }
        if (nextGroupId) void refreshGroupDetail(nextGroupId, { mode: 'refreshing' });
      } catch (err) {
        console.error(err);
        message.error(t('toast.chat.executeFailed'));
      } finally {
        setSending(false);
      }
    },
    [chatTimeWindow, message, refreshGroupDetail, repoId, robotId, sending, t, taskGroupId]
  );

  const canRunChatInGroup = Boolean(
    !taskGroupId || group?.kind === 'chat' || group?.kind === 'issue' || group?.kind === 'merge_request' || group?.kind === 'commit'
  );
  const canSend = Boolean(repoId && robotId && draft.trim()) && canRunChatInGroup;

  const openTask = useCallback((task: Task) => {
    window.location.hash = buildTaskHash(task.id);
  }, []);

  const openTaskGroupList = useCallback(() => {
    // Provide a quick hop from chat view to the taskgroup card list. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    window.location.hash = buildTaskGroupsHash();
  }, []);

  const loadOlderTasks = useCallback(() => {
    const container = chatBodyRef.current;
    if (!container) return;
    // Keep the default view bounded (latest 3 tasks) until users explicitly scroll up to load older tasks. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    const currentHidden = taskPagingPinnedToLatest ? pinnedHiddenCount : taskHiddenCount;
    if (currentHidden <= 0) return;
    if (chatPrependInFlightRef.current) return;

    chatPrependInFlightRef.current = true;
    chatPrependScrollRestoreRef.current = { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight };
    setTaskPagingPinnedToLatest(false);
    setTaskHiddenCount(Math.max(0, currentHidden - TASK_PAGE_SIZE));
  }, [pinnedHiddenCount, taskHiddenCount, taskPagingPinnedToLatest]);

  // Use group-id readiness to gate blocking UI states so stale loading flags cannot mask loaded content. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
  const isGroupReady = !taskGroupId || group?.id === taskGroupId;
  const isGroupBlocking = Boolean(taskGroupId) && !isGroupReady;

  const handleChatScroll = useCallback(() => {
    const container = chatBodyRef.current;
    if (!container) return;

    const remainingBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    chatAutoScrollEnabledRef.current = remainingBottom < 24;

    if (container.scrollTop < 48) {
      loadOlderTasks();
    }
  }, [loadOlderTasks]);

  useLayoutEffect(() => {
    // Preserve scroll position when older tasks are prepended (reverse paging). docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    const container = chatBodyRef.current;
    const pending = chatPrependScrollRestoreRef.current;
    if (!container || !pending) return;

    const delta = container.scrollHeight - pending.scrollHeight;
    container.scrollTop = pending.scrollTop + Math.max(0, delta);
    chatPrependScrollRestoreRef.current = null;
    chatPrependInFlightRef.current = false;
  }, [taskHiddenCount, orderedTasks.length]);

  useLayoutEffect(() => {
    // Default the TaskGroup chat view to the bottom (latest tasks) and keep it pinned when the user is already at the bottom. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    const container = chatBodyRef.current;
    if (!container) return;
    if (!taskGroupId) return;
    // Skip auto-scroll while the active group is still blocking to prevent stale loaders from freezing layout. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
    if (isGroupBlocking) return;
    if (!visibleTasks.length) return;
    if (chatPrependScrollRestoreRef.current) return;

    if (!chatDidInitScrollRef.current) {
      container.scrollTop = container.scrollHeight;
      chatDidInitScrollRef.current = true;
      chatAutoScrollEnabledRef.current = true;
      return;
    }

    if (chatAutoScrollEnabledRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isGroupBlocking, taskGroupId, visibleTasks.length, orderedTasks.length, taskHiddenCount]);

  useEffect(() => {
    // Keep the chat pinned to the bottom when async log rendering changes height and the user hasn't scrolled away. docs/en/developer/plans/taskgroupscrollbottom20260123/task_plan.md taskgroupscrollbottom20260123
    const container = chatBodyRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let lastHeight = container.scrollHeight;

    const shouldPinToBottom = () => {
      // Track content-driven height changes so slow log loads still land at the bottom. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
      if (!taskGroupId) return false;
      // Avoid pinning while the group is in a blocking load to keep skeleton state consistent. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
      if (isGroupBlocking) return false;
      if (chatPrependScrollRestoreRef.current) return false;
      if (!chatAutoScrollEnabledRef.current) return false;
      return true;
    };

    const schedulePin = () => {
      const nextHeight = container.scrollHeight;
      if (nextHeight === lastHeight) return;
      lastHeight = nextHeight;
      if (!shouldPinToBottom()) return;

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const target = chatBodyRef.current;
        if (!target) return;
        target.scrollTop = target.scrollHeight;
      });
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedulePin) : null;
    resizeObserver?.observe(container);

    const mutationObserver =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(schedulePin) : null;
    mutationObserver?.observe(container, { childList: true, subtree: true, characterData: true });

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isGroupBlocking, taskGroupId]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const isCentered = !taskGroupId || (orderedTasks.length === 0 && !isGroupBlocking);
  const composerMode: 'centered' | 'inline' = isCentered ? 'centered' : 'inline';
  const composerTextAreaAutoSize = useMemo(
    () =>
      composerMode === 'centered'
        ? // UX (Chat / New group): start with a comfortable multi-line input so first-time users can write detailed prompts.
          { minRows: 3, maxRows: 12 }
        : // UX (Chat / Task group): default to a single-line input like modern messengers; expand only when users add new lines.
          { minRows: 1, maxRows: 8 },
    [composerMode]
  );

  const composerNode = (
    <div className="hc-composer-container">
      <div className={`hc-composer-box hc-composer-box--${composerMode} ${isInputFocused ? 'hc-composer-box--focused' : ''}`}>
        <div className="hc-composer-input-wrapper">
          <Input.TextArea
            // UX (Chat / Composer): keep the TextArea borderless and let the outer `.hc-composer-box`
            // own the focus ring to avoid "double borders" when the input is focused.
            variant="borderless"
            className="hc-composer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('chat.form.textPlaceholder')}
            autoSize={composerTextAreaAutoSize}
            disabled={!canRunChatInGroup}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend(draft);
              }
            }}
          />
        </div>

        <div className="hc-composer-footer">
          {/* Keep the time-window icon on the far left for a compact composer. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 */}
          <div className="hc-composer-footer-left">
            <Popover
              trigger="click"
              placement="bottomLeft"
              content={
                <TimeWindowPicker
                  value={chatTimeWindow}
                  onChange={setChatTimeWindow}
                  disabled={!canRunChatInGroup}
                  size="small"
                  showTimezoneHint={false}
                />
              }
            >
              <Button
                size="small"
                type="text"
                aria-label={t('chat.form.timeWindow')}
                title={t('chat.form.timeWindow')}
                disabled={!canRunChatInGroup}
                icon={<ClockCircleOutlined />}
                className={chatTimeWindowLabel ? 'hc-timewindow-toggle is-active' : 'hc-timewindow-toggle'}
              />
            </Popover>
            {chatTimeWindowLabel ? (
              <Typography.Text type="secondary" className="hc-timewindow-label">
                {chatTimeWindowLabel}
              </Typography.Text>
            ) : null}
          </div>

          <div className="hc-composer-footer-right">
            <Space size={0} wrap style={{ gap: 4 }}>
              <Select
                variant="borderless"
                showSearch
                optionFilterProp="label"
                style={{ width: 'auto', minWidth: 100 }}
                placeholder={t('chat.repoPlaceholder')}
                loading={reposLoading}
                value={repoId || undefined}
                disabled={repoLocked}
                aria-label={t('chat.repo')}
                onChange={(value) => setRepoId(String(value))}
                options={repoOptions}
                popupMatchSelectWidth={false}
                size="small"
                className="hc-select-subtle"
              />
              <span style={{ color: 'var(--border)', userSelect: 'none', margin: '0 4px' }}>|</span>
              <Select
                variant="borderless"
                showSearch
                optionFilterProp="label"
                style={{ width: 'auto', minWidth: 100 }}
                placeholder={t('chat.form.robotPlaceholder')}
                loading={robotsLoading}
                value={robotId || undefined}
                aria-label={t('chat.form.robot')}
                onChange={(value) => setRobotId(String(value))}
                options={robotOptions}
                disabled={!canRunChatInGroup}
                popupMatchSelectWidth={false}
                size="small"
                className="hc-select-subtle"
              />
            </Space>
            <Button
              type="primary"
              shape="round"
              icon={<SendOutlined />}
              loading={sending}
              disabled={!canSend}
              onClick={() => void handleSend(draft)}
            >
              {t('chat.form.send')}
            </Button>
          </div>
        </div>
      </div>

      {!canRunChatInGroup && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12 }}>
          {t('chat.form.unsupportedGroupTip')}
        </Typography.Text>
      )}
    </div>
  );

  return (
    <div className="hc-page">
      {/* Surface a list shortcut in the chat header for quick navigation. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
      <PageNav
        title={taskGroupId ? groupTitle || t('chat.page.groupTitleFallback') : t('chat.page.newGroupTitle')}
        meta={
          <Typography.Text type="secondary">
            {taskGroupId ? `${t('chat.page.updatedAt')}: ${groupUpdatedAtText || '-'}` : t('chat.page.newGroupHint')}
          </Typography.Text>
        }
        actions={
          <Space>
            {taskGroupId && (
              <Popover content={previewAggregateStatusLabel}>
                <Button
                  onClick={handlePreviewToggle}
                  loading={previewActionLoading || previewAggregateStatus === 'starting'}
                  disabled={
                    previewLoading || previewActionLoading || (!previewAvailable && previewAggregateStatus === 'stopped')
                  }
                >
                  <span
                    className={`hc-preview-status-dot hc-preview-status-dot--${previewAggregateStatus}`}
                    aria-hidden="true"
                  />
                  <span style={{ marginLeft: 8 }}>
                    {previewAggregateStatus === 'running' || previewAggregateStatus === 'starting'
                      ? t('preview.action.stop')
                      : t('preview.action.start')}
                  </span>
                </Button>
              </Popover>
            )}
            <Button icon={<UnorderedListOutlined />} onClick={() => openTaskGroupList()}>
              {t('taskGroups.page.viewAll')}
            </Button>
          </Space>
        }
        userPanel={userPanel}
      />

      {/* Enable draggable split layout between chat and preview panels. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
      <div
        className={`hc-chat-layout${previewDragActive ? ' hc-chat-layout--dragging' : ''}`}
        ref={layoutRef}
      >
        <div className="hc-chat-panel">
          <div className="hc-chat-body" ref={chatBodyRef} onScroll={handleChatScroll}>
            {isGroupBlocking ? (
              // Render skeleton chat items while the active task group is blocking on data. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
              <ChatTimelineSkeleton testId="hc-chat-group-skeleton" ariaLabel={t('common.loading')} />
            ) : isCentered ? (
              <div className="hc-chat-centered-view">
                <div className="hc-chat-hero">
                  <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 12 }}>
                    {t('chat.welcome.title')}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 16 }}>
                    {t('chat.welcome.desc')}
                  </Typography.Paragraph>
                </div>
                {composerNode}
              </div>
            ) : (
              <div className="hc-chat-timeline">
                {/* Animate the most recent message to create a smooth transition into the timeline. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123 */}
                {visibleTasks.map((task) => (
                  <TaskConversationItem
                    key={task.id}
                    task={task}
                    entering={task.id === recentTaskId}
                    taskDetail={taskDetailsById[task.id] ?? null}
                    onOpenTask={openTask}
                    taskLogsEnabled={effectiveTaskLogsEnabled}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Keep the inline composer visible once the group is ready, even if a stale load flag lingers. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126 */}
          {!isCentered && !isGroupBlocking && (
            <div className="hc-chat-footer-composer">{composerNode}</div>
          )}
        </div>

        {/* Render the preview panel whenever previews are active or starting. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
        {taskGroupId && previewPanelOpen && (
          <>
            {/* Add draggable divider between chat and preview panels. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
            <div
              className={`hc-preview-divider${previewDragActive ? ' hc-preview-divider--active' : ''}`}
              role="separator"
              aria-orientation="vertical"
              aria-valuemin={PREVIEW_PANEL_MIN_WIDTH}
              aria-valuemax={previewPanelMaxWidth || undefined}
              aria-valuenow={previewPanelWidth ?? undefined}
              onPointerDown={handlePreviewDividerPointerDown}
            >
              <span className="hc-preview-divider-handle" aria-hidden="true" />
            </div>
            <aside className="hc-preview-panel" style={previewPanelStyle}>
              {/* Render multi-instance preview tabs with logs/share controls. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
              <div className="hc-preview-header">
                <div className="hc-preview-header-main">
                  <Typography.Text strong>{t('preview.panel.title')}</Typography.Text>
                  <Space size={6}>
                    <span
                      className={`hc-preview-status-dot hc-preview-status-dot--${previewAggregateStatus}`}
                      aria-hidden="true"
                    />
                    <Typography.Text type="secondary">{previewAggregateStatusLabel}</Typography.Text>
                  </Space>
                </div>
                <div className="hc-preview-header-actions">
                  <Tooltip title={t('preview.logs.open')}>
                    <Button
                      size="small"
                      icon={<FileTextOutlined />}
                      disabled={!activePreviewInstance}
                      onClick={() => setPreviewLogsOpen(true)}
                    />
                  </Tooltip>
                  <Tooltip title={t('preview.action.openWindow')}>
                    <Button size="small" icon={<ExportOutlined />} disabled={!previewIframeSrc} onClick={handleOpenPreviewWindow} />
                  </Tooltip>
                  <Tooltip title={t('preview.action.copyLink')}>
                    <Button size="small" icon={<CopyOutlined />} disabled={!previewIframeSrc} onClick={handleCopyPreviewLink} />
                  </Tooltip>
                </div>
              </div>
              {previewInstances.length > 0 && (
                <div className="hc-preview-tabs">
                  {previewInstances.map((instance) => (
                    <button
                      key={instance.name}
                      type="button"
                      className={`hc-preview-tab${instance.name === activePreviewName ? ' hc-preview-tab--active' : ''}`}
                      onClick={() => setActivePreviewName(instance.name)}
                    >
                      <span
                        className={`hc-preview-status-dot hc-preview-status-dot--${instance.status}`}
                        aria-hidden="true"
                      />
                      <span className="hc-preview-tab-name">{instance.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="hc-preview-body">
                {activePreviewStatus === 'running' && previewIframeSrc ? (
                  <iframe
                    className="hc-preview-iframe"
                    title={activePreviewInstance?.name ?? 'preview'}
                    src={previewIframeSrc}
                    loading="lazy"
                  />
                ) : (
                  <div className="hc-preview-placeholder">
                    <Typography.Text type="secondary">{previewPlaceholderText}</Typography.Text>
                    {activePreviewInstance?.message && activePreviewStatus !== 'running' && (
                      <Typography.Text type="secondary" className="hc-preview-message">
                        {activePreviewInstance.message}
                      </Typography.Text>
                    )}
                    {/* Render diagnostics when preview startup fails or times out. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
                    {previewDiagnostics && (activePreviewStatus === 'failed' || activePreviewStatus === 'timeout') && (
                      <div className="hc-preview-diagnostics">
                        <Typography.Text type="secondary" className="hc-preview-diagnostics-title">
                          {t('preview.diagnostics.title')}
                        </Typography.Text>
                        <div className="hc-preview-diagnostics-meta">
                          <span>
                            {t('preview.diagnostics.exitCode')}: {previewDiagnostics.exitCode ?? '-'}
                          </span>
                          <span>
                            {t('preview.diagnostics.signal')}: {previewDiagnostics.signal ?? '-'}
                          </span>
                        </div>
                        {previewDiagnosticsLogs.length > 0 && (
                          <div className="hc-preview-diagnostics-logs">
                            <span className="hc-preview-diagnostics-logs-label">
                              {t('preview.diagnostics.logs')}
                            </span>
                            <div className="hc-preview-diagnostics-logs-list">
                              {previewDiagnosticsLogs.map((entry, idx) => (
                                <div key={`${entry.timestamp}-${idx}`} className="hc-preview-diagnostics-log-line">
                                  <span className="hc-preview-diagnostics-log-level">{entry.level.toUpperCase()}</span>
                                  <span className="hc-preview-diagnostics-log-message">{entry.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Preview log modal is driven by SSE when open. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
      <Modal
        open={previewLogsOpen}
        title={
          activePreviewInstance
            ? `${t('preview.logs.title')} · ${activePreviewInstance.name}`
            : t('preview.logs.title')
        }
        footer={null}
        onCancel={() => setPreviewLogsOpen(false)}
        width={760}
      >
        <div className="hc-preview-log-meta">
          <Typography.Text type="secondary">{activePreviewStatusLabel}</Typography.Text>
          <Typography.Text type="secondary">
            {t('preview.logs.count', { count: previewLogs.length })}
          </Typography.Text>
        </div>
        <div className="hc-preview-log-body">
          {previewLogsLoading ? (
            <Typography.Text type="secondary">{t('preview.logs.loading')}</Typography.Text>
          ) : previewLogs.length === 0 ? (
            <Typography.Text type="secondary">{t('preview.logs.empty')}</Typography.Text>
          ) : (
            <div className="hc-preview-log-list">
              {previewLogs.map((entry, idx) => (
                <div key={`${entry.timestamp}-${idx}`} className={`hc-preview-log-line hc-preview-log-line--${entry.level}`}>
                  <span className="hc-preview-log-time">{formatPreviewLogTime(entry.timestamp)}</span>
                  <span className="hc-preview-log-level">{entry.level.toUpperCase()}</span>
                  <span className="hc-preview-log-message">{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
