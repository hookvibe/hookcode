// Extract the log viewer header controls into a focused component. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Button, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, PauseOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TFunction } from '../../i18n';
import type { ViewerMode } from './timeline';

export type TaskLogViewerHeaderProps = {
  t: TFunction;
  connecting: boolean;
  error: string | null;
  logsCount: number;
  showPauseButton: boolean;
  showReconnectButton: boolean;
  paused: boolean;
  onTogglePaused: () => void;
  onReconnect: () => void;
  mode: ViewerMode;
  onToggleMode: () => void;
  showReasoning: boolean;
  onToggleShowReasoning: (next: boolean) => void;
  wrapDiffLines: boolean;
  onToggleWrapDiffLines: (next: boolean) => void;
  showLineNumbers: boolean;
  onToggleShowLineNumbers: (next: boolean) => void;
  onCopy: () => void;
  onClear: () => void;
  clearing: boolean;
};

export const TaskLogViewerHeader = ({
  t,
  connecting,
  error,
  logsCount,
  showPauseButton,
  showReconnectButton,
  paused,
  onTogglePaused,
  onReconnect,
  mode,
  onToggleMode,
  showReasoning,
  onToggleShowReasoning,
  wrapDiffLines,
  onToggleWrapDiffLines,
  showLineNumbers,
  onToggleShowLineNumbers,
  onCopy,
  onClear,
  clearing
}: TaskLogViewerHeaderProps) => (
  <div className="log-viewer__header">
    <Space size={8} wrap>
      <Typography.Text className="log-viewer__title">{t('execViewer.title')}</Typography.Text>
      <Tag color={connecting ? 'processing' : error ? 'red' : 'green'} style={{ marginRight: 0 }}>
        {connecting ? t('logViewer.state.connecting') : error ? t('logViewer.state.error') : t('logViewer.state.live')}
      </Tag>
      <Typography.Text type="secondary">{t('logViewer.lines', { count: logsCount })}</Typography.Text>
    </Space>
    <Space size={8} wrap>
      {showPauseButton ? (
        <Button size="small" icon={paused ? <PlayCircleOutlined /> : <PauseOutlined />} onClick={onTogglePaused}>
          {paused ? t('logViewer.actions.resume') : t('logViewer.actions.pause')}
        </Button>
      ) : null}
      {showReconnectButton ? (
        <Button size="small" icon={<ReloadOutlined />} onClick={onReconnect}>
          {t('logViewer.actions.reconnect')}
        </Button>
      ) : null}
      <Button size="small" onClick={onToggleMode}>
        {mode === 'timeline' ? t('execViewer.actions.showRaw') : t('execViewer.actions.showTimeline')}
      </Button>
      {mode === 'timeline' ? (
        <>
          <Tooltip title={t('execViewer.toggles.reasoning')}>
            <Switch size="small" checked={showReasoning} onChange={onToggleShowReasoning} />
          </Tooltip>
          <Tooltip title={t('execViewer.toggles.wrapDiff')}>
            <Switch size="small" checked={wrapDiffLines} onChange={onToggleWrapDiffLines} />
          </Tooltip>
          <Tooltip title={t('execViewer.toggles.lineNumbers')}>
            <Switch size="small" checked={showLineNumbers} onChange={onToggleShowLineNumbers} />
          </Tooltip>
        </>
      ) : null}
      <Button size="small" icon={<CopyOutlined />} onClick={onCopy}>
        {t('logViewer.actions.copy')}
      </Button>
      <Button size="small" danger icon={<DeleteOutlined />} onClick={onClear} loading={clearing}>
        {t('logViewer.actions.clear')}
      </Button>
    </Space>
  </div>
);
