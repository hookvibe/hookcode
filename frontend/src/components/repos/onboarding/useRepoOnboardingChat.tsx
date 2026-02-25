// Extract onboarding chat test logic into a dedicated hook. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RepoRobot, Repository } from '../../../api';
import { executeChat, fetchTask, type Task } from '../../../api';
import type { TFunction } from '../../../i18n';
import { extractTaskResultText, isTerminalStatus } from '../../../utils/task';
import { formatRobotLabelWithProvider } from '../../../utils/robot';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'done' | 'error';
  taskId?: string;
};

export const useRepoOnboardingChat = ({
  repo,
  robots,
  t
}: {
  repo: Repository;
  robots: RepoRobot[];
  t: TFunction;
}) => {
  const enabledRobots = useMemo(() => (robots ?? []).filter((r) => Boolean(r?.enabled)), [robots]);
  const robotOptions = useMemo(
    () =>
      enabledRobots.map((r) => ({
        value: r.id,
        // Add bound AI provider to robot selection labels in onboarding chat. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
        label: formatRobotLabelWithProvider(r.name || r.id, r.modelProvider)
      })),
    [enabledRobots]
  );

  const [chatRobotId, setChatRobotId] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const lastTaskGroupIdRef = useRef<string>(''); // Store the last chat taskGroupId so the wizard can deep-link to the full timeline. 58w1q3n5nr58flmempxe
  const pollTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (!pollTimerRef.current) return;
    window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const updateAssistantFromTask = useCallback(
    (task: Task) => {
      const taskId = task.id;
      const terminal = isTerminalStatus(task.status);
      const resultText = extractTaskResultText(task) || '';

      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.taskId !== taskId || m.role !== 'assistant') return m;
          if (!terminal) return { ...m, status: 'pending', text: t('repos.onboarding.chat.pending') };
          if (task.status === 'success') {
            return { ...m, status: 'done', text: resultText || t('repos.onboarding.chat.resultEmpty') };
          }
          return { ...m, status: 'error', text: resultText || t('repos.onboarding.chat.failed') };
        })
      );
    },
    [t]
  );

  const pollTaskUntilTerminal = useCallback(
    (taskId: string) => {
      stopPolling();
      pollTimerRef.current = window.setInterval(async () => {
        try {
          const detail = await fetchTask(taskId);
          updateAssistantFromTask(detail);
          if (isTerminalStatus(detail.status)) stopPolling();
        } catch {
          // Keep polling: transient fetch errors should not break the onboarding chat test UX. 58w1q3n5nr58flmempxe
        }
      }, 2000);
    },
    [stopPolling, updateAssistantFromTask]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    // Keep robot selection valid when robot list changes. 58w1q3n5nr58flmempxe
    if (!robotOptions.length) {
      setChatRobotId('');
      return;
    }
    setChatRobotId((prev) => (prev && robotOptions.some((o) => o.value === prev) ? prev : robotOptions[0]?.value ?? ''));
  }, [robotOptions]);

  const handleSendChat = useCallback(async () => {
    if (!chatRobotId || chatSending) return;
    const text = chatDraft.trim();
    if (!text) return;
    setChatSending(true);
    try {
      const res = await executeChat({ repoId: repo.id, robotId: chatRobotId, text });
      const taskId = res.task.id;
      lastTaskGroupIdRef.current = res.taskGroup.id;

      setChatDraft('');
      setChatMessages((prev) => [
        ...prev,
        { id: `u_${taskId}`, role: 'user', text, status: 'done' },
        { id: `a_${taskId}`, role: 'assistant', text: t('repos.onboarding.chat.pending'), status: 'pending', taskId }
      ]);

      pollTaskUntilTerminal(taskId);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text, status: 'done' },
        { id: `a_${Date.now()}`, role: 'assistant', text: t('repos.onboarding.chat.failed'), status: 'error' }
      ]);
    } finally {
      setChatSending(false);
    }
  }, [chatDraft, chatRobotId, chatSending, pollTaskUntilTerminal, repo.id, t]);

  const lastAssistantText = useMemo(() => {
    const last = [...chatMessages].reverse().find((m) => m.role === 'assistant');
    return last?.text ?? '';
  }, [chatMessages]);

  return {
    robotOptions,
    chatRobotId,
    setChatRobotId,
    chatDraft,
    setChatDraft,
    chatSending,
    chatMessages,
    handleSendChat,
    lastAssistantText,
    lastTaskGroupIdRef
  };
};
