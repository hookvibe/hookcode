import { useMemo, useState } from 'react';
import { Button, Dropdown, Input, Popover, Select, Typography } from 'antd';
import {
  ClockCircleOutlined,
  CodeOutlined,
  DownOutlined,
  FolderOutlined,
  GlobalOutlined,
  RobotOutlined,
  SendOutlined,
  SettingOutlined,
  ToolOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
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

/* ---------------------------------------------------------------------------
 * Pill selector helper — builds Ant Dropdown menu items from option arrays.
 * ------------------------------------------------------------------------ */
const buildDropdownItems = (
  options: TaskGroupComposerOption[],
  selectedValue: string,
  onChange: (value: string) => void
): MenuProps['items'] =>
  options.map((opt) => ({
    key: opt.value,
    label: opt.label,
    style: opt.value === selectedValue ? { fontWeight: 600, background: 'rgba(0,0,0,0.04)' } : undefined,
    onClick: () => onChange(opt.value)
  }));

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

  /* ---------------------------------------------------------------------------
   * Resolved display labels for the Pill selectors.
   * ------------------------------------------------------------------------ */
  const selectedRepoLabel = repoOptions.find((o) => o.value === repoId)?.label;
  const selectedRobotLabel = robotOptions.find((o) => o.value === robotId)?.label;
  const selectedWorkerLabel = workerOptions.find((o) => o.value === (workerId || '__auto__'))?.label;

  /* ---------------------------------------------------------------------------
   * Centered mode: Pill selector header — repo → robot → worker above the input.
   * Robot pill is disabled until a repo is selected.
   * ------------------------------------------------------------------------ */
  const centeredHeaderNode = centered ? (
    <div className="hc-composer-header">
      {/* Repository pill */}
      <Dropdown
        menu={{ items: buildDropdownItems(repoOptions, repoId, (v) => onRepoChange(v)) }}
        trigger={['click']}
        disabled={repoLocked || reposLoading}
      >
        <span className={`hc-pill${repoId ? ' hc-pill--active' : ''}${repoLocked ? ' hc-pill--disabled' : ''}`}>
          <FolderOutlined className="hc-pill__icon" />
          <span className="hc-pill__label">
            {reposLoading ? '...' : selectedRepoLabel || t('chat.repoPlaceholder')}
          </span>
          {!repoLocked && <DownOutlined className="hc-pill__arrow" />}
        </span>
      </Dropdown>

      {/* Robot pill — disabled until repo is chosen */}
      <Dropdown
        menu={{ items: buildDropdownItems(robotOptions, robotId, (v) => onRobotChange(v)) }}
        trigger={['click']}
        disabled={!repoId || robotsLoading}
      >
        <span className={`hc-pill${robotId ? ' hc-pill--active' : ''}${!repoId ? ' hc-pill--disabled' : ''}`}>
          <RobotOutlined className="hc-pill__icon" />
          <span className="hc-pill__label">
            {robotsLoading ? '...' : selectedRobotLabel || t('chat.form.robotPlaceholder')}
          </span>
          <DownOutlined className="hc-pill__arrow" />
        </span>
      </Dropdown>

      {/* Worker pill — admin only */}
      {showWorkerSelector ? (
        <Dropdown
          menu={{
            items: buildDropdownItems(workerOptions, workerId || '__auto__', (v) =>
              onWorkerChange(v === '__auto__' ? '' : v)
            )
          }}
          trigger={['click']}
          disabled={workerLocked || workersLoading || !repoId}
        >
          <span
            className={`hc-pill${workerId ? ' hc-pill--active' : ''}${workerLocked || !repoId ? ' hc-pill--disabled' : ''}`}
          >
            <CodeOutlined className="hc-pill__icon" />
            <span className="hc-pill__label">
              {workersLoading ? '...' : selectedWorkerLabel || t('chat.form.workerPlaceholder')}
            </span>
            {!workerLocked && <DownOutlined className="hc-pill__arrow" />}
          </span>
        </Dropdown>
      ) : null}
    </div>
  ) : null;

  /* ---------------------------------------------------------------------------
   * Inline mode: compact robot dropdown trigger placed next to the send button.
   * ------------------------------------------------------------------------ */
  const inlineRobotDropdownNode = !centered ? (
    <Dropdown
      menu={{ items: buildDropdownItems(robotOptions, robotId, (v) => onRobotChange(v)) }}
      trigger={['click']}
      disabled={robotsLoading || !canRun}
    >
      <span className="hc-robot-dropdown-trigger">
        <RobotOutlined style={{ fontSize: 14 }} />
        <span className="hc-robot-dropdown-trigger__label">
          {selectedRobotLabel || t('chat.form.robot')}
        </span>
        <DownOutlined className="hc-robot-dropdown-trigger__arrow" />
      </span>
    </Dropdown>
  ) : null;

  /* ---------------------------------------------------------------------------
   * Settings popover content — in centered mode only show Advanced section
   * (repo/robot/worker are already exposed as pills above the input).
   * In inline mode also skip repo/worker (locked), robot is next to send button.
   * ------------------------------------------------------------------------ */
  const composerActionsContent = (
    <div className="hc-composer-actions">
      <div className="hc-composer-action-section">
        <span className="hc-composer-action-section__title">{t('chat.form.advanced')}</span>
        <div className="hc-composer-action-block">
          <Typography.Text type="secondary" className="hc-composer-action-title">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
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
        <div className="hc-composer-action-row">
          <Button size="small" icon={<GlobalOutlined />} disabled={previewStartDisabled} onClick={onStartPreview}>
            {t('preview.action.start')}
          </Button>
          <Button size="small" icon={<ToolOutlined />} disabled={skillsButtonDisabled} onClick={onOpenSkills}>
            {t('skills.selection.action.configure')}
          </Button>
        </div>
        {skillModeLabel ? (
          <Typography.Text type="secondary" className="hc-composer-action-hint">
            {skillModeLabel}
          </Typography.Text>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="hc-composer-container">
      <div className={`hc-composer-box hc-composer-box--${composerMode} ${isInputFocused ? 'hc-composer-box--focused' : ''}`}>
        {/* Centered mode: pill selector header above textarea */}
        {centeredHeaderNode}

        <div className="hc-composer-input-wrapper">
          <Input.TextArea
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
                icon={<SettingOutlined />}
                className="hc-composer-settings-btn"
              />
            </Popover>
            {chatTimeWindowLabel ? (
              <Typography.Text type="secondary" className="hc-timewindow-label">
                {chatTimeWindowLabel}
              </Typography.Text>
            ) : null}
          </div>

          <div className="hc-composer-footer-right">
            {/* Inline mode: compact robot dropdown next to send */}
            {inlineRobotDropdownNode}
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
