import { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App, Button, Input, Select, Space, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { RepoRobot, Repository, Task, TaskGroup } from '../api';
import { executeChat, fetchTask, fetchTaskGroup, fetchTaskGroupTasks, listRepoRobots, listRepos } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskGroupHash, buildTaskHash } from '../router';
import { TaskConversationItem } from '../components/chat/TaskConversationItem';
import { PageNav } from '../components/nav/PageNav';
import { isTerminalStatus } from '../utils/task';
import { ChatTimelineSkeleton } from '../components/skeletons/ChatTimelineSkeleton';

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

  const [groupLoading, setGroupLoading] = useState(false);
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDetailsById, setTaskDetailsById] = useState<Record<string, Task | null>>({});
  // Track the latest sent task so it can animate into its final chat position. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  const [recentTaskId, setRecentTaskId] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

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
        label: r.name || r.id
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
        setGroupLoading(false);
        return;
      }

      const mode = options?.mode ?? 'blocking';
      if (mode === 'refreshing' && groupRequestInFlightRef.current) return;

      const requestSeq = (groupRequestSeqRef.current += 1);
      groupRequestInFlightRef.current = true;

      const shouldBlock = mode === 'blocking' || !groupRef.current;
      if (shouldBlock) setGroupLoading(true);

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
        message.error(t('toast.chat.groupLoadFailed'));
        groupRef.current = null;
        setGroup(null);
        setTasks([]);
        setTaskDetailsById({});
      } finally {
        if (groupRequestSeqRef.current !== requestSeq) return;
        groupRequestInFlightRef.current = false;
        setGroupLoading(false);
      }
    },
    [message, t]
  );

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
          taskGroupId: taskGroupId || undefined
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
    [message, refreshGroupDetail, repoId, robotId, sending, t, taskGroupId]
  );

  const canRunChatInGroup = Boolean(
    !taskGroupId || group?.kind === 'chat' || group?.kind === 'issue' || group?.kind === 'merge_request' || group?.kind === 'commit'
  );
  const canSend = Boolean(repoId && robotId && draft.trim()) && canRunChatInGroup;

  const openTask = useCallback((task: Task) => {
    window.location.hash = buildTaskHash(task.id);
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
    if (groupLoading) return;
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
  }, [groupLoading, taskGroupId, visibleTasks.length, orderedTasks.length, taskHiddenCount]);

  useEffect(() => {
    // Keep the chat pinned to the bottom when async log rendering changes height and the user hasn't scrolled away. docs/en/developer/plans/taskgroupscrollbottom20260123/task_plan.md taskgroupscrollbottom20260123
    const container = chatBodyRef.current;
    if (!container) return;
    if (typeof ResizeObserver === 'undefined') return;

    let rafId: number | null = null;
    let lastHeight = container.scrollHeight;

    const observer = new ResizeObserver(() => {
      const nextHeight = container.scrollHeight;
      if (nextHeight === lastHeight) return;
      lastHeight = nextHeight;
      if (!taskGroupId) return;
      if (groupLoading) return;
      if (chatPrependScrollRestoreRef.current) return;
      if (!chatAutoScrollEnabledRef.current) return;

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const target = chatBodyRef.current;
        if (!target) return;
        target.scrollTop = target.scrollHeight;
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [groupLoading, taskGroupId]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const isCentered = !taskGroupId || (orderedTasks.length === 0 && !groupLoading);
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

      {!canRunChatInGroup && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12 }}>
          {t('chat.form.unsupportedGroupTip')}
        </Typography.Text>
      )}
    </div>
  );

  return (
    <div className="hc-page">
      <PageNav
        title={taskGroupId ? groupTitle || t('chat.page.groupTitleFallback') : t('chat.page.newGroupTitle')}
        meta={
          <Typography.Text type="secondary">
            {taskGroupId ? `${t('chat.page.updatedAt')}: ${groupUpdatedAtText || '-'}` : t('chat.page.newGroupHint')}
          </Typography.Text>
        }
        userPanel={userPanel}
      />

      <div className="hc-chat-body" ref={chatBodyRef} onScroll={handleChatScroll}>
        {groupLoading && taskGroupId ? (
          // Render skeleton chat items instead of a generic Empty+icon while the group is loading. ro3ln7zex8d0wyynfj0m
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

      {!isCentered && !groupLoading && (
        <div className="hc-chat-footer-composer">{composerNode}</div>
      )}
    </div>
  );
};
