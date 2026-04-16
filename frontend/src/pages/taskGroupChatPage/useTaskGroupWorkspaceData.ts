import { App } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { AvailableRobot, Repository, SkillSelectionKey, SkillSelectionState, Task, TaskGroup, TimeWindow, WorkerRecord } from '../../api';
import {
  executeChat,
  fetchTask,
  fetchTaskGroup,
  fetchTaskGroupSkillSelection,
  fetchTaskGroupTasks,
  fetchAllRepos,
  fetchWorkers,
  listAvailableRepoRobots,
  updateTaskGroupSkillSelection
} from '../../api';
import { getApiErrorMessage } from '../../api/client';
import type { TFunction } from '../../i18n';
import { buildTaskGroupHash } from '../../router';
import { formatRobotOptionLabel } from '../../utils/robot';
import { getWorkerProviderLabel, isWorkerProviderAvailable, normalizeWorkerProviderKey } from '../../utils/workerRuntime';
import { formatWorkerOptionLabel } from '../../utils/workers';
import { getStoredUser } from '../../auth';
import { createAuthedEventSource } from '../../utils/sse';

const GROUP_REFRESH_NOTICE_COOLDOWN_MS = 15000;
const GROUP_REFRESH_NOTICE_KEY = 'task-group-refresh-warning';

type MessageApi = ReturnType<typeof App.useApp>['message'];
type SelectOption = { value: string; label: string };

type RefreshGroupDetail = (targetGroupId: string, options?: { mode?: 'blocking' | 'refreshing' }) => Promise<void>;

type UseTaskGroupWorkspaceDataParams = {
  taskGroupId?: string;
  locale: string;
  t: TFunction;
  message: MessageApi;
};

type UseTaskGroupWorkspaceDataResult = {
  chatBodyRef: MutableRefObject<HTMLDivElement | null>;
  reposLoading: boolean;
  repoId: string;
  setRepoId: Dispatch<SetStateAction<string>>;
  repoOptions: SelectOption[];
  repoLocked: boolean;
  robotsLoading: boolean;
  robotId: string;
  setRobotId: Dispatch<SetStateAction<string>>;
  robotOptions: SelectOption[];
  workersLoading: boolean;
  workerId: string;
  setWorkerId: Dispatch<SetStateAction<string>>;
  workerOptions: SelectOption[];
  workerLocked: boolean;
  showWorkerSelector: boolean;
  group: TaskGroup | null;
  groupMissing: boolean;
  orderedTasks: Task[];
  taskById: Map<string, Task>;
  taskDetailsById: Record<string, Task | null>;
  setTaskDetailsById: Dispatch<SetStateAction<Record<string, Task | null>>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  sending: boolean;
  chatTimeWindow: TimeWindow | null;
  setChatTimeWindow: Dispatch<SetStateAction<TimeWindow | null>>;
  skillSelection: SkillSelectionState | null;
  skillSelectionLoading: boolean;
  skillSelectionSaving: boolean;
  skillSelectionOpen: boolean;
  setSkillSelectionOpen: Dispatch<SetStateAction<boolean>>;
  skillModeLabel: string;
  groupTitle: string;
  groupUpdatedAtText: string;
  canRunChatInGroup: boolean;
  canSend: boolean;
  isGroupBlocking: boolean;
  isEmptyGroup: boolean;
  isCentered: boolean;
  refreshSkillSelection: () => Promise<void>;
  saveSkillSelection: (nextSelection: SkillSelectionKey[] | null) => Promise<void>;
  refreshGroupDetail: RefreshGroupDetail;
  ensureTaskDetail: (taskId: string) => Promise<Task | null>;
  handleSend: (text: string) => Promise<void>;
};

export const useTaskGroupWorkspaceData = ({
  taskGroupId,
  locale,
  t,
  message
}: UseTaskGroupWorkspaceDataParams): UseTaskGroupWorkspaceDataResult => {
  const [reposLoading, setReposLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoId, setRepoId] = useState('');
  const [robotsLoading, setRobotsLoading] = useState(false);
  const [robots, setRobots] = useState<AvailableRobot[]>([]);
  const [robotId, setRobotId] = useState('');
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [workerId, setWorkerId] = useState('');
  const [group, setGroup] = useState<TaskGroup | null>(null);
  const [groupMissing, setGroupMissing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskDetailsById, setTaskDetailsById] = useState<Record<string, Task | null>>({});
  const [taskGroupStreamConnected, setTaskGroupStreamConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatTimeWindow, setChatTimeWindow] = useState<TimeWindow | null>(null);
  const [skillSelection, setSkillSelection] = useState<SkillSelectionState | null>(null);
  const [skillSelectionLoading, setSkillSelectionLoading] = useState(false);
  const [skillSelectionSaving, setSkillSelectionSaving] = useState(false);
  const [skillSelectionOpen, setSkillSelectionOpen] = useState(false);

  const taskDetailRequestRef = useRef<Record<string, Promise<Task | null>>>({});
  const taskGroupStreamRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<TaskGroup | null>(null);
  const optimisticGroupIdRef = useRef<string | null>(null);
  const groupRequestSeqRef = useRef(0);
  const groupRequestInFlightRef = useRef(false);
  const lastGroupRefreshNoticeAtRef = useRef(0);

  const repoLocked = Boolean(taskGroupId);
  const currentUser = getStoredUser();
  const isAdmin = Boolean(currentUser?.roles?.includes('admin'));

  const refreshSkillSelection = useCallback(async () => {
    // Keep task-group skill overrides loaded with the workspace data so the composer and modal stay in sync. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    if (!taskGroupId) return;
    setSkillSelectionLoading(true);
    try {
      const selection = await fetchTaskGroupSkillSelection(taskGroupId);
      setSkillSelection(selection);
    } catch (error) {
      console.error(error);
      message.error(t('skills.selection.toast.fetchFailed'));
      setSkillSelection(null);
    } finally {
      setSkillSelectionLoading(false);
    }
  }, [message, t, taskGroupId]);

  const saveSkillSelection = useCallback(async (nextSelection: SkillSelectionKey[] | null) => {
    // Persist task-group skill overrides beside the workspace data flow so modal saves reuse the same source of truth. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    if (!taskGroupId) return;
    setSkillSelectionSaving(true);
    try {
      const updated = await updateTaskGroupSkillSelection(taskGroupId, nextSelection);
      setSkillSelection(updated);
      message.success(t('skills.selection.toast.saved'));
    } catch (error) {
      console.error(error);
      message.error(t('skills.selection.toast.saveFailed'));
    } finally {
      setSkillSelectionSaving(false);
    }
  }, [message, t, taskGroupId]);

  const enabledRepos = useMemo(() => repos.filter((repo) => repo.enabled), [repos]);
  const enabledRobots = useMemo(() => robots.filter((robot) => Boolean(robot?.enabled)), [robots]);
  const availableWorkers = useMemo(() => {
    const items = workers.filter((worker) => worker.status !== 'disabled');
    if (group?.workerSummary && !items.some((worker) => worker.id === group.workerSummary?.id)) {
      return [group.workerSummary as WorkerRecord, ...items];
    }
    return items;
  }, [group?.workerSummary, workers]);

  const repoOptions = useMemo<SelectOption[]>(() => enabledRepos.map((repo) => ({
    value: repo.id,
    label: repo.name ? `${repo.name} (${repo.provider === 'github' ? 'GitHub' : 'GitLab'})` : repo.id
  })), [enabledRepos]);

  const robotOptions = useMemo<SelectOption[]>(() => enabledRobots.map((robot) => ({
    value: robot.id,
    label: formatRobotOptionLabel(robot)
  })), [enabledRobots]);

  const workerLocked = Boolean(taskGroupId && group?.workerId);
  const workerOptions = useMemo<SelectOption[]>(() => {
    const options = availableWorkers.map((worker) => ({
      value: worker.id,
      label: formatWorkerOptionLabel(t, worker)
    }));
    if (workerLocked) return options;
    return [{ value: '__auto__', label: t('chat.form.workerAuto') }, ...options];
  }, [availableWorkers, t, workerLocked]);
  const showWorkerSelector = isAdmin;

  const orderedTasks = useMemo(() => {
    // Keep queue cards sorted from the persisted group order so visual links match backend execution order. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const list = [...tasks];
    list.sort((taskA, taskB) => {
      const orderA = taskA.sequence?.order ?? taskA.groupOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = taskB.sequence?.order ?? taskB.groupOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const createdDiff = new Date(taskA.createdAt).getTime() - new Date(taskB.createdAt).getTime();
      if (createdDiff !== 0) return createdDiff;
      return taskA.id.localeCompare(taskB.id);
    });
    return list;
  }, [tasks]);

  // Keep a polling safety net while queued/processing tasks are visible because a just-created group can miss the first SSE status event during route handoff. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const hasActiveTasks = useMemo(
    () => orderedTasks.some((task) => task.status === 'queued' || task.status === 'waiting_approval' || task.status === 'processing'),
    [orderedTasks]
  );

  const taskById = useMemo(() => new Map(orderedTasks.map((task) => [task.id, task])), [orderedTasks]);
  const selectedRobotProvider = useMemo(() => {
    const robot = robots.find((item) => item.id === robotId);
    return normalizeWorkerProviderKey(robot?.modelProvider ?? 'codex');
  }, [robotId, robots]);
  const selectedWorkerRecord = useMemo(() => {
    const targetWorkerId = String(workerId ?? '').trim();
    if (!targetWorkerId) return null;
    return workers.find((worker) => worker.id === targetWorkerId) ?? null;
  }, [workerId, workers]);
  const selectedWorkerProviderGuardMessage = useMemo(() => {
    if (!selectedWorkerRecord || !selectedRobotProvider) return null;
    if (isWorkerProviderAvailable(selectedWorkerRecord, selectedRobotProvider)) return null;
    const providerLabel = getWorkerProviderLabel(selectedRobotProvider);
    const workerName = selectedWorkerRecord.name || selectedWorkerRecord.id;
    return t('chat.validation.workerProviderMissing', { provider: providerLabel, worker: workerName });
  }, [selectedRobotProvider, selectedWorkerRecord, t]);

  const groupTitle = useMemo(() => {
    if (!group) return '';
    const title = String(group.title ?? '').trim();
    return title || group.id;
  }, [group]);

  const groupUpdatedAtText = useMemo(() => {
    if (!group?.updatedAt) return '';
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(group.updatedAt));
    } catch {
      return group.updatedAt;
    }
  }, [group?.updatedAt, locale]);

  const refreshRepos = useCallback(async () => {
    // Fetch repo options once per mount path and keep the first enabled repo as the default without refetching on every picker change. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    setReposLoading(true);
    try {
      const data = await fetchAllRepos();
      setRepos(data);
      const firstEnabledRepoId = data.find((repo) => repo.enabled)?.id ?? '';
      setRepoId((previousRepoId) => previousRepoId || firstEnabledRepoId);
    } catch (error) {
      console.error(error);
      message.error(t('toast.chat.reposLoadFailed'));
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, [message, t]);

  const refreshRobots = useCallback(async (targetRepoId: string, preferredRobotId?: string) => {
    if (!targetRepoId) {
      setRobots([]);
      setRobotId('');
      return;
    }
    setRobotsLoading(true);
    try {
      const data = await listAvailableRepoRobots(targetRepoId);
      const list = Array.isArray(data) ? data : [];
      setRobots(list);
      const enabled = list.filter((robot) => Boolean(robot?.enabled));
      const nextRobot =
        (preferredRobotId && enabled.find((robot) => robot.id === preferredRobotId)) ||
        enabled.find((robot) => robot.isDefault) ||
        enabled[0] ||
        null;
      setRobotId((previousRobotId) => {
        const previousStillValid = previousRobotId && enabled.some((robot) => robot.id === previousRobotId);
        return previousStillValid ? previousRobotId : nextRobot?.id ?? '';
      });
    } catch (error) {
      console.error(error);
      message.error(t('toast.chat.robotsLoadFailed'));
      setRobots([]);
      setRobotId('');
    } finally {
      setRobotsLoading(false);
    }
  }, [message, t]);


  const refreshWorkers = useCallback(async () => {
    // Load worker options for admin-only selectors so chat routing can target a specific executor. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    if (!isAdmin) {
      setWorkers([]);
      return;
    }
    setWorkersLoading(true);
    try {
      const nextWorkers = await fetchWorkers();
      setWorkers(nextWorkers);
    } catch (error) {
      console.error(error);
      message.error(t('workers.toast.fetchFailed'));
      setWorkers([]);
    } finally {
      setWorkersLoading(false);
    }
  }, [isAdmin, message, t]);

  const refreshGroupDetail = useCallback<RefreshGroupDetail>(async (targetGroupId, options) => {
    // Centralize group/task fetching, optimistic transitions, and refresh throttling so the page only renders workspace composition. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    if (!targetGroupId) {
      groupRequestSeqRef.current += 1;
      groupRequestInFlightRef.current = false;
      groupRef.current = null;
      setGroup(null);
      setGroupMissing(false);
      setTasks([]);
      setTaskDetailsById({});
      setWorkerId('');
      return;
    }

    const mode = options?.mode ?? 'blocking';
    if (mode === 'refreshing' && groupRequestInFlightRef.current) return;

    const requestSeq = (groupRequestSeqRef.current += 1);
    groupRequestInFlightRef.current = true;
    setGroupMissing(false);

    try {
      const [nextGroup, taskList] = await Promise.all([
        fetchTaskGroup(targetGroupId),
        fetchTaskGroupTasks(targetGroupId, { limit: 50 })
      ]);
      if (groupRequestSeqRef.current !== requestSeq) return;
      setGroup(nextGroup);
      groupRef.current = nextGroup;
      setGroupMissing(false);
      setTasks(taskList);
      if (nextGroup?.repoId) setRepoId(nextGroup.repoId);
      setWorkerId(nextGroup?.workerId ?? '');
    } catch (error) {
      if (groupRequestSeqRef.current !== requestSeq) return;
      console.error(error);
      const requestError = error as any;
      const status = requestError?.response?.status as number | undefined;
      const isNetworkFailure = !requestError?.response;
      if (status === 404) {
        groupRef.current = null;
        setGroup(null);
        setGroupMissing(true);
        setTasks([]);
        setTaskDetailsById({});
        setWorkerId('');
        return;
      }
      const shouldPreserveSnapshot = Boolean(groupRef.current) && (isNetworkFailure || (status !== undefined && status >= 500));
      if (mode === 'refreshing') {
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
        setWorkerId('');
      }
    } finally {
      if (groupRequestSeqRef.current !== requestSeq) return;
      groupRequestInFlightRef.current = false;
    }
  }, [message, t]);

  useEffect(() => {
    if (!taskGroupId) {
      taskGroupStreamRef.current?.close();
      taskGroupStreamRef.current = null;
      setTaskGroupStreamConnected(false);
      return;
    }

    const source = createAuthedEventSource('/events/stream', { topics: `task-group:${taskGroupId}` });
    taskGroupStreamRef.current = source;

    const handleReady = () => setTaskGroupStreamConnected(true);
    const handleRefresh = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}') as { groupId?: string };
        if (payload.groupId && payload.groupId !== taskGroupId) return;
        void refreshGroupDetail(taskGroupId, { mode: 'refreshing' });
      } catch {
        // Ignore malformed task-group refresh events so the shared stream keeps running. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      }
    };

    source.addEventListener('ready', handleReady);
    source.addEventListener('task-group.refresh', handleRefresh);
    source.onerror = () => setTaskGroupStreamConnected(false);

    return () => {
      source.removeEventListener('ready', handleReady);
      source.removeEventListener('task-group.refresh', handleRefresh);
      source.close();
      taskGroupStreamRef.current = null;
      setTaskGroupStreamConnected(false);
    };
  }, [refreshGroupDetail, taskGroupId]);

  useEffect(() => {
    void refreshRepos();
    void refreshWorkers();
  }, [refreshRepos, refreshWorkers]);

  useEffect(() => {
    if (!repoId) return;
    void refreshRobots(repoId, group?.robotId ?? undefined);
  }, [group?.robotId, refreshRobots, repoId]);

  useEffect(() => {
    if (!taskGroupId) {
      void refreshGroupDetail('');
      setSkillSelection(null);
      setSkillSelectionOpen(false);
      return;
    }
    const isOptimisticGroup = optimisticGroupIdRef.current === taskGroupId;
    const refreshPromise = refreshGroupDetail(taskGroupId, { mode: isOptimisticGroup ? 'refreshing' : 'blocking' });
    if (isOptimisticGroup) {
      void refreshPromise.finally(() => {
        if (optimisticGroupIdRef.current === taskGroupId) optimisticGroupIdRef.current = null;
      });
    } else {
      void refreshPromise;
    }

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!taskGroupStreamConnected || hasActiveTasks) {
      pollTimerRef.current = window.setInterval(() => {
        void refreshGroupDetail(taskGroupId, { mode: 'refreshing' });
      }, 5000);
    }
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [hasActiveTasks, refreshGroupDetail, taskGroupId, taskGroupStreamConnected]);

  useEffect(() => {
    // Load skill-selection state automatically when entering a task-group workspace so the button label and modal are ready immediately. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    if (!taskGroupId) return;
    void refreshSkillSelection();
  }, [refreshSkillSelection, taskGroupId]);

  const ensureTaskDetail = useCallback(async (taskId: string): Promise<Task | null> => {
    if (taskDetailsById[taskId] !== undefined) return taskDetailsById[taskId] ?? null;
    if (taskDetailRequestRef.current[taskId]) return taskDetailRequestRef.current[taskId];

    const request = fetchTask(taskId)
      .then((detail) => {
        setTaskDetailsById((previousTaskDetails) => ({ ...previousTaskDetails, [taskId]: detail }));
        return detail;
      })
      .catch((error) => {
        console.error(error);
        setTaskDetailsById((previousTaskDetails) => ({ ...previousTaskDetails, [taskId]: null }));
        return null;
      })
      .finally(() => {
        delete taskDetailRequestRef.current[taskId];
      });

    taskDetailRequestRef.current[taskId] = request;
    return request;
  }, [taskDetailsById]);

  useEffect(() => {
    // Eagerly hydrate approval-gated task details so queue cards can render approval summaries/actions without opening logs first. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313
    orderedTasks
      .filter(
        (task) =>
          (task.status === 'waiting_approval' || Boolean(task.approvalRequest)) &&
          !task.approvalRequest &&
          taskDetailsById[task.id] === undefined
      )
      .forEach((task) => {
        void ensureTaskDetail(task.id);
      });
  }, [ensureTaskDetail, orderedTasks, taskDetailsById]);

  const handleSend = useCallback(async (text: string) => {
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
    if (selectedWorkerProviderGuardMessage) {
      // Block obvious provider/runtime mismatches in the composer when the admin already chose a concrete worker, while backend validation remains the real safety boundary. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
      message.warning(selectedWorkerProviderGuardMessage);
      return;
    }
    if (sending) return;

    setSending(true);
    try {
      const result = await executeChat({
        repoId,
        robotId,
        text: trimmed,
        taskGroupId: taskGroupId || undefined,
        timeWindow: chatTimeWindow,
        workerId: workerId || undefined
      });
      message.success(t('toast.chat.executeSuccess'));
      setDraft('');

      const nextGroupId = result.taskGroup?.id ?? '';
      if (nextGroupId && !taskGroupId) {
        optimisticGroupIdRef.current = nextGroupId;
        window.location.hash = buildTaskGroupHash(nextGroupId);
      }
      setGroup(result.taskGroup ?? null);
      groupRef.current = result.taskGroup ?? null;
      setWorkerId(result.taskGroup?.workerId ?? workerId);
      if (result.task?.id) {
        setTasks((previousTasks) => [...previousTasks.filter((task) => task.id !== result.task.id), result.task]);
      }
      if (nextGroupId) void refreshGroupDetail(nextGroupId, { mode: 'refreshing' });
    } catch (error) {
      console.error(error);
      message.error(getApiErrorMessage(error) || t('toast.chat.executeFailed'));
    } finally {
      setSending(false);
    }
  }, [chatTimeWindow, message, refreshGroupDetail, repoId, robotId, selectedWorkerProviderGuardMessage, sending, t, taskGroupId, workerId]);

  const canRunChatInGroup = Boolean(
    !taskGroupId || group?.kind === 'chat' || group?.kind === 'issue' || group?.kind === 'merge_request' || group?.kind === 'commit'
  );
  const canSend = Boolean(repoId && robotId && draft.trim()) && canRunChatInGroup;
  const isGroupReady = !taskGroupId || group?.id === taskGroupId || groupMissing;
  const isGroupBlocking = Boolean(taskGroupId) && !isGroupReady;
  const isEmptyGroup = Boolean(taskGroupId) && !isGroupBlocking && (groupMissing || orderedTasks.length === 0);
  const isCentered = !taskGroupId;

  const skillModeLabel = useMemo(() => {
    if (!skillSelection) return t('common.loading');
    if (skillSelection.mode === 'custom') return t('skills.selection.mode.custom');
    if (skillSelection.mode === 'repo_default') return t('skills.selection.mode.repoDefault');
    return t('skills.selection.mode.all');
  }, [skillSelection, t]);

  return {
    chatBodyRef,
    reposLoading,
    repoId,
    setRepoId,
    repoOptions,
    repoLocked,
    robotsLoading,
    robotId,
    setRobotId,
    robotOptions,
    workersLoading,
    workerId,
    setWorkerId,
    workerOptions,
    workerLocked,
    showWorkerSelector,
    group,
    groupMissing,
    orderedTasks,
    taskById,
    taskDetailsById,
    setTaskDetailsById,
    draft,
    setDraft,
    sending,
    chatTimeWindow,
    setChatTimeWindow,
    skillSelection,
    skillSelectionLoading,
    skillSelectionSaving,
    skillSelectionOpen,
    setSkillSelectionOpen,
    skillModeLabel,
    groupTitle,
    groupUpdatedAtText,
    canRunChatInGroup,
    canSend,
    isGroupBlocking,
    isEmptyGroup,
    isCentered,
    refreshSkillSelection,
    saveSkillSelection,
    refreshGroupDetail,
    ensureTaskDetail,
    handleSend
  };
};
