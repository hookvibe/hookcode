import type { RefObject } from 'react';
import { Button, Input, Tooltip, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CopyOutlined,
  ExportOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LockOutlined,
  ReloadOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import type { PreviewDiagnostics, PreviewInstanceStatus, PreviewInstanceSummary, PreviewLogEntry } from '../../api';
import { useT } from '../../i18n';

type PreviewAddressMeta = {
  isSecure: boolean;
};

type TaskGroupPreviewWorkspaceProps = {
  previewInstances: PreviewInstanceSummary[];
  activePreviewName: string | null;
  onSelectPreview: (name: string) => void;
  previewAggregateStatus: PreviewInstanceStatus;
  activePreviewInstance: PreviewInstanceSummary | null;
  activePreviewIsTerminal: boolean;
  currentPreviewIframeSrc: string;
  previewAddressInput: string;
  previewAddress: string;
  previewAddressMeta: PreviewAddressMeta;
  previewAutoNavigateLocked: boolean;
  showInlineTerminalLogs: boolean;
  previewLogsLoading: boolean;
  previewLogs: PreviewLogEntry[];
  previewTerminalOutput: string;
  activePreviewStatus: PreviewInstanceStatus;
  previewPlaceholderText: string;
  previewDiagnostics?: PreviewDiagnostics;
  previewDiagnosticsLogs: PreviewLogEntry[];
  previewTerminalBodyRef: RefObject<HTMLDivElement>;
  previewIframeRef: RefObject<HTMLIFrameElement>;
  onOpenLogs: () => void;
  onOpenWindow: () => void;
  onCopyLink: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleAutoNavigateLock: () => void;
  onAddressInputChange: (value: string) => void;
  onAddressFocus: () => void;
  onAddressBlur: () => void;
  onNavigate: () => void;
  onTerminalScroll: () => void;
  onIframeLoad: () => void;
};

type TaskGroupPreviewLogTabProps = {
  statusLabel: string;
  previewLogsLoading: boolean;
  previewLogs: PreviewLogEntry[];
  formatPreviewLogTime: (value: string) => string;
};

export const TaskGroupPreviewWorkspace = ({
  previewInstances,
  activePreviewName,
  onSelectPreview,
  previewAggregateStatus,
  activePreviewInstance,
  activePreviewIsTerminal,
  currentPreviewIframeSrc,
  previewAddressInput,
  previewAddress,
  previewAddressMeta,
  previewAutoNavigateLocked,
  showInlineTerminalLogs,
  previewLogsLoading,
  previewLogs,
  previewTerminalOutput,
  activePreviewStatus,
  previewPlaceholderText,
  previewDiagnostics,
  previewDiagnosticsLogs,
  previewTerminalBodyRef,
  previewIframeRef,
  onOpenLogs,
  onOpenWindow,
  onCopyLink,
  onBack,
  onForward,
  onReload,
  onToggleAutoNavigateLock,
  onAddressInputChange,
  onAddressFocus,
  onAddressBlur,
  onNavigate,
  onTerminalScroll,
  onIframeLoad
}: TaskGroupPreviewWorkspaceProps) => {
  const t = useT();

  // Encapsulate the right-side preview surface so TaskGroupChatPage can focus on data orchestration instead of browser chrome markup. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  return (
    <>
      <div className="hc-preview-header">
        <div className="hc-preview-header-top">
          <div className="hc-preview-tabs">
            {previewInstances.length > 0 ? (
              previewInstances.map((instance) => (
                <button
                  key={instance.name}
                  type="button"
                  className={`hc-preview-tab${instance.name === activePreviewName ? ' hc-preview-tab--active' : ''}`}
                  onClick={() => onSelectPreview(instance.name)}
                >
                  <span className={`hc-preview-status-dot hc-preview-status-dot--${instance.status}`} aria-hidden="true" />
                  <span className="hc-preview-tab-name">{instance.name}</span>
                </button>
              ))
            ) : (
              <div className="hc-preview-tab hc-preview-tab--active">
                <span className={`hc-preview-status-dot hc-preview-status-dot--${previewAggregateStatus}`} aria-hidden="true" />
                <span className="hc-preview-tab-name">{t('preview.panel.title')}</span>
              </div>
            )}
          </div>
          <div className="hc-preview-header-actions">
            <Tooltip title={t('taskGroup.workspace.previewLogsTab')}>
              <Button
                size="small"
                type="text"
                icon={<FileTextOutlined />}
                disabled={!activePreviewInstance}
                onClick={onOpenLogs}
              />
            </Tooltip>
            {!activePreviewIsTerminal && (
              <>
                <Tooltip title={t('preview.action.openWindow')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<ExportOutlined />}
                    disabled={!currentPreviewIframeSrc}
                    onClick={onOpenWindow}
                  />
                </Tooltip>
                <Tooltip title={t('preview.action.copyLink')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    disabled={!currentPreviewIframeSrc}
                    onClick={onCopyLink}
                  />
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {activePreviewIsTerminal ? null : (
          <div className="hc-preview-header-toolbar">
            <div className="hc-preview-header-nav">
              <Button
                size="small"
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('preview.browser.back')}
                disabled={!currentPreviewIframeSrc}
                onClick={onBack}
              />
              <Button
                size="small"
                type="text"
                icon={<ArrowRightOutlined />}
                aria-label={t('preview.browser.forward')}
                disabled={!currentPreviewIframeSrc}
                onClick={onForward}
              />
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                aria-label={t('preview.browser.refresh')}
                disabled={!currentPreviewIframeSrc}
                onClick={onReload}
              />
            </div>

            <Input
              size="small"
              className="hc-preview-header-browser-input"
              value={previewAddressInput}
              placeholder={t('preview.browser.placeholder')}
              aria-label={t('preview.browser.placeholder')}
              prefix={
                <span
                  className={`hc-preview-header-browser-prefix${previewAddressMeta.isSecure ? ' hc-preview-header-browser-prefix--secure' : ''}`}
                  aria-hidden="true"
                >
                  {previewAddressMeta.isSecure ? <LockOutlined /> : <GlobalOutlined />}
                </span>
              }
              suffix={
                <Tooltip title={previewAutoNavigateLocked ? t('preview.browser.unlockAutoNav') : t('preview.browser.lockAutoNav')}>
                  <Button
                    size="small"
                    type="text"
                    className="hc-preview-header-browser-lock"
                    icon={previewAutoNavigateLocked ? <LockOutlined /> : <UnlockOutlined />}
                    aria-label={previewAutoNavigateLocked ? t('preview.browser.unlockAutoNav') : t('preview.browser.lockAutoNav')}
                    onClick={onToggleAutoNavigateLock}
                  />
                </Tooltip>
              }
              title={previewAddressInput || previewAddress}
              disabled={!currentPreviewIframeSrc}
              onChange={(event) => onAddressInputChange(event.target.value)}
              onFocus={onAddressFocus}
              onBlur={onAddressBlur}
              onPressEnter={onNavigate}
            />
          </div>
        )}
      </div>
      <div className="hc-preview-body">
        {showInlineTerminalLogs ? (
          <div className="hc-preview-terminal" ref={previewTerminalBodyRef} onScroll={onTerminalScroll}>
            {previewLogsLoading ? (
              <pre className="hc-preview-terminal-output">{t('preview.logs.loading')}</pre>
            ) : previewLogs.length === 0 ? (
              <pre className="hc-preview-terminal-output">{t('preview.logs.empty')}</pre>
            ) : (
              <pre className="hc-preview-terminal-output">{previewTerminalOutput}</pre>
            )}
          </div>
        ) : activePreviewStatus === 'running' && currentPreviewIframeSrc ? (
          <div className="hc-preview-iframe-shell">
            <iframe
              className="hc-preview-iframe"
              title={activePreviewInstance?.name ?? 'preview'}
              src={currentPreviewIframeSrc}
              sandbox="allow-scripts allow-same-origin allow-forms"
              loading="lazy"
              ref={previewIframeRef}
              onLoad={onIframeLoad}
            />
          </div>
        ) : (
          <div className="hc-preview-placeholder">
            <Typography.Text type="secondary">{previewPlaceholderText}</Typography.Text>
            {activePreviewInstance?.message && activePreviewStatus !== 'running' && (
              <Typography.Text type="secondary" className="hc-preview-message">
                {activePreviewInstance.message}
              </Typography.Text>
            )}
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
                    <span className="hc-preview-diagnostics-logs-label">{t('preview.diagnostics.logs')}</span>
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
    </>
  );
};

export const TaskGroupPreviewLogTab = ({
  statusLabel,
  previewLogsLoading,
  previewLogs,
  formatPreviewLogTime
}: TaskGroupPreviewLogTabProps) => {
  const t = useT();

  // Keep preview log tab rendering separate from page-level tab assembly so preview diagnostics stay reusable. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  return (
    <>
      <div className="hc-preview-log-meta">
        <Typography.Text type="secondary">{statusLabel}</Typography.Text>
        <Typography.Text type="secondary">{t('preview.logs.count', { count: previewLogs.length })}</Typography.Text>
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
    </>
  );
};
