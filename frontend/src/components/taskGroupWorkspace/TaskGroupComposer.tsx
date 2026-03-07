import { useMemo, useState } from 'react';
import { Button, Input, Popover, Select, Space, Typography } from 'antd';
import { ClockCircleOutlined, GlobalOutlined, SendOutlined, ToolOutlined } from '@ant-design/icons';
import type { TimeWindow } from '../../api';
import { useT } from '../../i18n';
import { TimeWindowPicker } from '../TimeWindowPicker';
import { formatTimeWindowLabel } from '../../utils/timeWindow';

type TaskGroupComposerOption = {
  value: string;
  label: string;
};

type TaskGroupComposerProps = {
  draft: string;
  onDraftChange: (next: string) => void;
  onSubmit: (text: string) => void;
  sending: boolean;
  canSend: boolean;
  canRun: boolean;
  centered: boolean;
  repoId: string;
  onRepoChange: (value: string) => void;
  repoLocked: boolean;
  reposLoading: boolean;
  repoOptions: TaskGroupComposerOption[];
  robotId: string;
  onRobotChange: (value: string) => void;
  robotsLoading: boolean;
  robotOptions: TaskGroupComposerOption[];
  // Surface admin-only worker override props beside repo/robot selection in the composer. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workersLoading: boolean;
  workerId: string;
  onWorkerChange: (value: string) => void;
  workerOptions: TaskGroupComposerOption[];
  workerLocked?: boolean;
  showWorkerSelector?: boolean;
  chatTimeWindow: TimeWindow | null;
  onChatTimeWindowChange: (next: TimeWindow | null) => void;
  previewStartDisabled: boolean;
  onStartPreview: () => void;
  skillsButtonDisabled: boolean;
  onOpenSkills: () => void;
  skillModeLabel: string;
};

export const TaskGroupComposer = ({
  draft,
  onDraftChange,
  onSubmit,
  sending,
  canSend,
  canRun,
  centered,
  repoId,
  onRepoChange,
  repoLocked,
  reposLoading,
  repoOptions,
  robotId,
  onRobotChange,
  robotsLoading,
  robotOptions,
  workersLoading,
  workerId,
  onWorkerChange,
  workerOptions,
  workerLocked = false,
  showWorkerSelector = false,
  chatTimeWindow,
  onChatTimeWindowChange,
  previewStartDisabled,
  onStartPreview,
  skillsButtonDisabled,
  onOpenSkills,
  skillModeLabel
}: TaskGroupComposerProps) => {
  const t = useT();
  const [composerActionsOpen, setComposerActionsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const composerMode: 'centered' | 'inline' = centered ? 'centered' : 'inline';
  const chatTimeWindowLabel = useMemo(() => formatTimeWindowLabel(chatTimeWindow), [chatTimeWindow]);
  const composerTextAreaAutoSize = useMemo(
    () =>
      composerMode === 'centered'
        ? { minRows: 3, maxRows: 12 }
        : { minRows: 1, maxRows: 8 },
    [composerMode]
  );

  // Isolate task submission controls so the queue workspace page can focus on orchestration flow. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const composerActionsContent = (
    <div className="hc-composer-actions">
      {/* Keep schedule, preview, and skill actions together under one compact composer menu. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
      <div className="hc-composer-action-block">
        <Typography.Text type="secondary" className="hc-composer-action-title">
          {t('chat.form.timeWindow')}
        </Typography.Text>
        <TimeWindowPicker
          value={chatTimeWindow}
          onChange={onChatTimeWindowChange}
          disabled={!canRun}
          size="small"
          showTimezoneHint={false}
        />
      </div>
      <div className="hc-composer-action-divider" aria-hidden="true" />
      <Button size="small" icon={<GlobalOutlined />} disabled={previewStartDisabled} onClick={onStartPreview}>
        {t('preview.action.start')}
      </Button>
      <div className="hc-composer-action-divider" aria-hidden="true" />
      <div className="hc-composer-action-block">
        <Typography.Text type="secondary" className="hc-composer-action-title">
          {t('skills.selection.taskGroup.title')}
        </Typography.Text>
        <Button size="small" icon={<ToolOutlined />} disabled={skillsButtonDisabled} onClick={onOpenSkills}>
          {t('skills.selection.action.configure')}
        </Button>
        <Typography.Text type="secondary" className="hc-composer-action-hint">
          {skillModeLabel}
        </Typography.Text>
      </div>
    </div>
  );

  return (
    <div className="hc-composer-container">
      <div className={`hc-composer-box hc-composer-box--${composerMode} ${isInputFocused ? 'hc-composer-box--focused' : ''}`}>
        <div className="hc-composer-input-wrapper">
          <Input.TextArea
            // Keep the TextArea borderless so the outer composer shell owns the single shared focus treatment. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
            variant="borderless"
            className="hc-composer-input"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={t('chat.form.textPlaceholder')}
            autoSize={composerTextAreaAutoSize}
            disabled={!canRun}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSubmit(draft);
              }
            }}
          />
        </div>

        <div className="hc-composer-footer">
          <div className="hc-composer-footer-left">
            <Popover
              trigger="click"
              placement="bottomLeft"
              open={composerActionsOpen}
              onOpenChange={setComposerActionsOpen}
              content={composerActionsContent}
            >
              <Button
                size="small"
                type="text"
                aria-label={t('chat.form.actions')}
                title={t('chat.form.actions')}
                disabled={!canRun}
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
                onChange={(value) => onRepoChange(String(value))}
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
                onChange={(value) => onRobotChange(String(value))}
                options={robotOptions}
                disabled={!canRun}
                popupMatchSelectWidth={false}
                size="small"
                className="hc-select-subtle"
              />
              {showWorkerSelector ? (
                <>
                  <span style={{ color: 'var(--border)', userSelect: 'none', margin: '0 4px' }}>|</span>
                  {/* Keep worker override close to repo/robot selection so manual chat routing stays explicit. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
                  <Select
                    variant="borderless"
                    showSearch
                    optionFilterProp="label"
                    style={{ width: 'auto', minWidth: 120 }}
                    placeholder={t('chat.form.workerPlaceholder')}
                    loading={workersLoading}
                    value={workerLocked ? (workerId || undefined) : (workerId || '__auto__')}
                    aria-label={t('chat.form.worker')}
                    onChange={(value) => onWorkerChange(String(value) === '__auto__' ? '' : String(value))}
                    options={workerOptions}
                    disabled={!canRun || workerLocked}
                    popupMatchSelectWidth={false}
                    size="small"
                    className="hc-select-subtle"
                  />
                </>
              ) : null}
            </Space>
            <Button
              type="primary"
              shape="round"
              icon={<SendOutlined />}
              loading={sending}
              disabled={!canSend}
              onClick={() => onSubmit(draft)}
            >
              {t('chat.form.send')}
            </Button>
          </div>
        </div>
      </div>

      {!canRun && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12 }}>
          {t('chat.form.unsupportedGroupTip')}
        </Typography.Text>
      )}
    </div>
  );
};
