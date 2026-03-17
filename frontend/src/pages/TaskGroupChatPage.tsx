import { FC, useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Modal, Popover, Space, Typography } from 'antd';
import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Task } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskGroupsHash } from '../router';
import { TaskGroupComposer } from '../components/taskGroupWorkspace/TaskGroupComposer';
import { TaskGroupLogPanel } from '../components/taskGroupWorkspace/TaskGroupLogPanel';
import { TaskGroupTaskCard } from '../components/taskGroupWorkspace/TaskGroupTaskCard';
import { TaskGroupWorkspacePanel } from '../components/taskGroupWorkspace/TaskGroupWorkspacePanel';
import { WorkerSummaryTag } from '../components/workers/WorkerSummaryTag';
import { PageNav, type PageNavMenuAction } from '../components/nav/PageNav';
import { getTaskTitle } from '../utils/task';
import { ChatTimelineSkeleton } from '../components/skeletons/ChatTimelineSkeleton';
import { SkillSelectionPanel } from '../components/skills/SkillSelectionPanel';
import { useSkillsCatalog } from '../hooks/useSkillsCatalog';
import { useTaskGroupPreviewWorkspace } from './taskGroupChatPage/useTaskGroupPreviewWorkspace';
import { useTaskGroupTaskActions } from './taskGroupChatPage/useTaskGroupTaskActions';
import { useTaskGroupWorkspaceData } from './taskGroupChatPage/useTaskGroupWorkspaceData';

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
 * - Task cards own submission metadata while execution logs move into the shared right workspace.
 *
 * Change record:
 * - 2026-01-11: Added for `frontend-chat` Home page migration (replace `#/chat` with `#/`).
 * - 2026-01-11: Improve i18n coverage and mobile-friendly sender controls.
 */

export interface TaskGroupChatPageProps {
  taskGroupId?: string;
  userPanel?: ReactNode;
  navToggle?: PageNavMenuAction;
}

export const TaskGroupChatPage: FC<TaskGroupChatPageProps> = ({ taskGroupId, userPanel, navToggle }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();
  const [openTaskLogIds, setOpenTaskLogIds] = useState<string[]>([]);
  const [activeWorkspaceTabKey, setActiveWorkspaceTabKey] = useState<string | null>(null);
  const { skills: skillsCatalog, loading: skillsCatalogLoading, refresh: refreshSkillsCatalog } = useSkillsCatalog();

  // Keep group/task data orchestration out of the page component so this file stays focused on workspace composition. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const {
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
  } = useTaskGroupWorkspaceData({
    taskGroupId,
    locale,
    t,
    message
  });

  // Keep preview runtime state inside a dedicated hook so the page only orchestrates task-group data + workspace composition. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const {
    layoutRef,
    previewDragActive,
    previewPanelOpen,
    previewPanelMinWidth,
    previewPanelMaxWidth,
    previewPanelWidth,
    previewPanelStyle,
    handlePreviewDividerPointerDown,
    previewLoading,
    previewActionLoading,
    previewStartModalOpen,
    previewInstallLoading,
    previewLogTabOpen,
    previewStartDisabled,
    previewAggregateStatus,
    previewAggregateStatusLabel,
    previewToggleIcon,
    previewTabItem,
    previewLogTabItem,
    handlePreviewToggle,
    handlePreviewStart,
    handlePreviewReinstall,
    handleComposerPreviewStart,
    closePreviewStartModal,
    closePreviewLogTab
  } = useTaskGroupPreviewWorkspace({
    taskGroupId,
    locale,
    t,
    message,
    activeWorkspaceTabKey,
    setActiveWorkspaceTabKey
  });
  const workspacePanelOpen = Boolean(taskGroupId) && (previewPanelOpen || previewLogTabOpen || openTaskLogIds.length > 0);

  const handleOpenTaskLogs = useCallback(
    (task: Task) => {
      // Open task execution logs as browser-like workspace tabs instead of inline chat details. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      const nextTabKey = `task-log:${task.id}`;
      setOpenTaskLogIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));
      setActiveWorkspaceTabKey(nextTabKey);
      void ensureTaskDetail(task.id);
    },
    [ensureTaskDetail]
  );

  const handleCloseWorkspaceTab = useCallback(
    (targetKey: string) => {
      if (targetKey === 'preview') return;
      if (targetKey === 'preview-log') {
        closePreviewLogTab(previewPanelOpen ? 'preview' : null);
        return;
      }
      const taskId = targetKey.replace(/^task-log:/u, '');
      setOpenTaskLogIds((prev) => prev.filter((currentId) => currentId !== taskId));
      setActiveWorkspaceTabKey((prev) => {
        if (prev !== targetKey) return prev;
        if (previewPanelOpen) return 'preview';
        const remaining = openTaskLogIds.filter((currentId) => currentId !== taskId);
        if (previewLogTabOpen) return 'preview-log';
        return remaining[0] ? `task-log:${remaining[0]}` : null;
      });
    },
    [closePreviewLogTab, openTaskLogIds, previewLogTabOpen, previewPanelOpen]
  );

  // Delegate queue-card task mutations to a focused hook so this page can stay centered on workspace orchestration. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const {
    taskActionLoadingKey,
    handleStopTask,
    handleRetryTask,
    handleDeleteQueuedTask,
    handleSaveQueuedTask,
    handleReorderQueuedTask,
    handleTaskMetaChanged
  } = useTaskGroupTaskActions({
    taskGroupId,
    message,
    t,
    refreshGroupDetail,
    setTaskDetailsById,
    setOpenTaskLogIds
  });

  const openTaskGroupList = useCallback(() => {
    // Provide a quick hop from chat view to the taskgroup card list. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    window.location.hash = buildTaskGroupsHash();
  }, []);

  useEffect(() => {
    // Reset task-log tabs when navigating between task groups so stale task ids never leak across routes. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    setOpenTaskLogIds([]);
    setActiveWorkspaceTabKey(null);
    setTaskDetailsById({});
  }, [setTaskDetailsById, taskGroupId]);

  useEffect(() => {
    // Prune workspace log tabs when queue edits or live refreshes remove tasks from the current snapshot. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    setOpenTaskLogIds((previousTaskIds) => previousTaskIds.filter((taskId) => taskById.has(taskId)));
  }, [taskById]);

  useEffect(() => {
    // Keep the active workspace tab aligned with whichever preview and log tabs are currently available. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const availableKeys = [
      previewPanelOpen ? 'preview' : null,
      previewLogTabOpen ? 'preview-log' : null,
      ...openTaskLogIds.map((taskId) => `task-log:${taskId}`)
    ].filter(Boolean) as string[];
    setActiveWorkspaceTabKey((prev) => {
      if (prev && availableKeys.includes(prev)) return prev;
      if (previewPanelOpen) return 'preview';
      return availableKeys[0] ?? null;
    });
  }, [openTaskLogIds, previewLogTabOpen, previewPanelOpen]);

  useLayoutEffect(() => {
    // Keep the workspace list pinned to the newest cards after task submissions and queue updates. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const container = chatBodyRef.current;
    if (!container) return;
    if (!taskGroupId || isGroupBlocking) return;
    container.scrollTop = container.scrollHeight;
  }, [chatBodyRef, isGroupBlocking, orderedTasks.length, taskGroupId]);

  const composerNode = (
    <TaskGroupComposer
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={(text) => {
        void handleSend(text);
      }}
      sending={sending}
      canSend={canSend}
      canRun={canRunChatInGroup}
      centered={isCentered}
      repoId={repoId}
      onRepoChange={setRepoId}
      repoLocked={repoLocked}
      reposLoading={reposLoading}
      repoOptions={repoOptions}
      robotId={robotId}
      onRobotChange={setRobotId}
      robotsLoading={robotsLoading}
      robotOptions={robotOptions}
      workersLoading={workersLoading}
      workerId={workerId}
      onWorkerChange={setWorkerId}
      workerOptions={workerOptions}
      workerLocked={workerLocked}
      showWorkerSelector={showWorkerSelector}
      chatTimeWindow={chatTimeWindow}
      onChatTimeWindowChange={setChatTimeWindow}
      previewStartDisabled={previewStartDisabled}
      onStartPreview={handleComposerPreviewStart}
      skillsButtonDisabled={!taskGroupId}
      onOpenSkills={() => setSkillSelectionOpen(true)}
      skillModeLabel={skillModeLabel}
    />
  );

  const workspaceTabItems = [
    ...(previewTabItem ? [previewTabItem] : []),
    ...(previewLogTabItem ? [previewLogTabItem] : []),
    ...openTaskLogIds
      .map((taskId) => taskById.get(taskId))
      .filter((task): task is Task => Boolean(task))
      .map((task) => ({
        key: `task-log:${task.id}`,
        label: (
          <span className="hc-task-workspace-tab-label">
            <FileTextOutlined />
            <span>
              {(task.sequence?.order ?? task.groupOrder) ? `#${task.sequence?.order ?? task.groupOrder} ` : ''}
              {getTaskTitle(task)}
            </span>
          </span>
        ),
        children: (
          <TaskGroupLogPanel
            task={task}
            taskDetail={taskDetailsById[task.id] ?? null}
            onTaskUpdated={async () => {
              await ensureTaskDetail(task.id);
              if (taskGroupId) {
                await refreshGroupDetail(taskGroupId, { mode: 'refreshing' });
              }
            }}
          />
        )
      }))
  ];

  return (
    <div className="hc-page">
      {/* Surface a list shortcut in the chat header for quick navigation. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
      <PageNav
        title={taskGroupId ? groupTitle || t('chat.page.groupTitleFallback') : t('chat.page.newGroupTitle')}
        meta={
          <>
            <Typography.Text type="secondary">
              {taskGroupId ? `${t('chat.page.updatedAt')}: ${groupUpdatedAtText || '-'}` : t('chat.page.newGroupHint')}
            </Typography.Text>
            {taskGroupId && group?.workerSummary ? (
              <>
                {/* Surface the bound worker in the chat header so task-group routing stays visible. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
                <span style={{ marginLeft: 12 }}><WorkerSummaryTag worker={group.workerSummary} workerId={group.workerId} /></span>
              </>
            ) : null}
            {taskGroupId && (
              <Typography.Text type="secondary" style={{ marginLeft: 12, fontSize: 12, opacity: 0.8 }}>
                • {t('taskGroup.workspace.taskCount', { count: orderedTasks.length })}
              </Typography.Text>
            )}
          </>
        }
        actions={
          <Space>
            {taskGroupId && (
              <Popover content={previewAggregateStatusLabel}>
                {/* Allow preview retries even when availability is stale. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
                <Button
                  // Keep the preview label visible on mobile headers so the action is discoverable. docs/en/developer/plans/dhbg1plvf7lvamcpt546/task_plan.md dhbg1plvf7lvamcpt546
                  className="hc-nav-action--keepLabel"
                  icon={previewToggleIcon}
                  onClick={handlePreviewToggle}
                  // Only show button loading for explicit user actions to avoid false "starting" lock states. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
                  loading={previewActionLoading}
                  disabled={previewLoading || previewActionLoading}
                >
                  {previewAggregateStatus === 'running' || previewAggregateStatus === 'starting'
                    ? t('preview.action.stop')
                    : t('preview.action.start')}
                </Button>
              </Popover>
            )}
          </Space>
        }
        // Provide the mobile nav toggle so chat can open the sidebar drawer. docs/en/developer/plans/dhbg1plvf7lvamcpt546/task_plan.md dhbg1plvf7lvamcpt546
        navToggle={navToggle}
        userPanel={userPanel}
      />

      {/* Enable draggable split layout between chat and preview panels. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
      <div
        className={`hc-chat-layout${previewDragActive ? ' hc-chat-layout--dragging' : ''}`}
        ref={layoutRef}
      >
        <div className="hc-chat-panel">
          <div className="hc-chat-body" ref={chatBodyRef}>
            {isGroupBlocking ? (
              // Render skeleton chat items while the active task group is blocking on data. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126
              <ChatTimelineSkeleton testId="hc-chat-group-skeleton" ariaLabel={t('common.loading')} />
            ) : isCentered ? (
              <div className="hc-welcome-container">
                <div className="hc-welcome-hero">
                  <h1 className="hc-welcome-title">
                    {t('chat.welcome.title')}
                  </h1>
                  <p className="hc-welcome-desc">
                    {t('chat.welcome.desc')}
                  </p>
                </div>
                {composerNode}
              </div>
            ) : (
              <div className="hc-chat-timeline hc-task-workspace-list">
                {isEmptyGroup ? (
                  // Render a friendly empty state when a task group has no tasks. docs/en/developer/plans/taskgroup-empty-display-20260203/task_plan.md taskgroup-empty-display-20260203
                  <div className="hc-chat-empty">
                    {/* Expand empty/missing task-group messaging to avoid dialog-only views. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 */}
                    {/* Use the current Ant Design Space orientation API so empty-state stacks stay warning-free. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
                    <Space orientation="vertical" size={8} align="center">
                      <Typography.Text type="secondary">
                        {groupMissing ? t('chat.page.missingGroup') : t('chat.page.emptyGroup')}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {groupMissing ? t('chat.page.missingGroupHint') : t('chat.page.emptyGroupHint')}
                      </Typography.Text>
                      <Button size="small" onClick={() => openTaskGroupList()}>
                        {t('taskGroups.page.viewAll')}
                      </Button>
                    </Space>
                  </div>
                ) : (
                  <div className="hc-task-workspace-list__content">
                    {orderedTasks.map((task) => (
                      <TaskGroupTaskCard
                        key={task.id}
                        task={taskDetailsById[task.id] ?? task}
                        onOpenLogs={handleOpenTaskLogs}
                        onRetry={handleRetryTask}
                        onStop={handleStopTask}
                        onDelete={handleDeleteQueuedTask}
                        onReorder={handleReorderQueuedTask}
                        onSaveEdit={handleSaveQueuedTask}
                        onApprovalUpdated={handleTaskMetaChanged}
                        actionLoading={taskActionLoadingKey}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Keep the inline composer visible once the group is ready, even if a stale load flag lingers. docs/en/developer/plans/taskgroup_skeleton_20260126/task_plan.md taskgroup_skeleton_20260126 */}
          {!isCentered && !isGroupBlocking && (
            <div className="hc-chat-footer-composer">{composerNode}</div>
          )}
        </div>

        {/* Render the shared workspace panel when preview or task log tabs are open. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
        <TaskGroupWorkspacePanel
          open={workspacePanelOpen}
          dividerActive={previewDragActive}
          previewPanelMinWidth={previewPanelMinWidth}
          previewPanelMaxWidth={previewPanelMaxWidth}
          previewPanelWidth={previewPanelWidth}
          previewPanelStyle={previewPanelStyle}
          onDividerPointerDown={handlePreviewDividerPointerDown}
          activeKey={activeWorkspaceTabKey}
          items={workspaceTabItems}
          onChange={setActiveWorkspaceTabKey}
          onCloseTab={handleCloseWorkspaceTab}
        />
      </div>

      {/* Render the preview start modal with a manual reinstall action. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}
      <Modal
        open={previewStartModalOpen}
        title={t('preview.start.title')}
        onCancel={closePreviewStartModal}
        maskClosable={!previewActionLoading && !previewInstallLoading}
        footer={
          <Space>
            <Button
              onClick={closePreviewStartModal}
              disabled={previewActionLoading || previewInstallLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handlePreviewReinstall}
              loading={previewInstallLoading}
              disabled={previewActionLoading}
            >
              {t('preview.deps.reinstall')}
            </Button>
            <Button
              type="primary"
              onClick={handlePreviewStart}
              loading={previewActionLoading}
              disabled={previewInstallLoading}
            >
              {t('preview.action.start')}
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary">
          {t('preview.start.desc')}
        </Typography.Paragraph>
      </Modal>

      {/* Provide task-group skill overrides inside a dedicated modal. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225 */}
      <Modal
        open={skillSelectionOpen}
        title={t('skills.selection.taskGroup.title')}
        onCancel={() => setSkillSelectionOpen(false)}
        footer={null}
        width={760}
      >
        <SkillSelectionPanel
          scope="task_group"
          skills={skillsCatalog}
          selection={skillSelection}
          loading={skillSelectionLoading || skillsCatalogLoading}
          saving={skillSelectionSaving}
          onRefresh={() => {
            void refreshSkillSelection();
            void refreshSkillsCatalog();
          }}
          onChange={saveSkillSelection}
        />
      </Modal>
    </div>
  );
};
